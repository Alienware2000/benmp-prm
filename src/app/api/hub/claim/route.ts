import { NextRequest, NextResponse } from "next/server";
import {
  claimPartnerForHub,
  getHubChurches,
  getHubCountry,
  releaseHubClaim,
} from "@/lib/hub/db";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Claim an unassigned giver for the signed-in hub, or release one it claimed
 * (Decision 0033). The hub comes from the session, never the body.
 * Body: `{ action: "claim", partnerId, churchId }` or `{ action: "release", partnerId }`.
 */
export async function POST(req: NextRequest) {
  const session = await verifyHubSessionToken(
    req.cookies.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?: unknown;
    partnerId?: unknown;
    churchId?: unknown;
  };
  const partnerId = typeof body.partnerId === "string" ? body.partnerId : "";
  if (!UUID.test(partnerId)) {
    return NextResponse.json(
      { ok: false, error: "Choose a giver." },
      { status: 400 },
    );
  }

  if (body.action === "release") {
    const result = await releaseHubClaim({
      hubId: session.hubId,
      hubLabel: session.hubLabel,
      partnerId,
    });
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json(
          {
            ok: false,
            error: "Only a giver your hub claimed can be released.",
          },
          { status: 400 },
        );
  }

  if (body.action !== "claim") {
    return NextResponse.json(
      { ok: false, error: "Unknown action." },
      { status: 400 },
    );
  }
  const churches = await getHubChurches(session.hubId);
  const church = churches.find((c) => c.id === body.churchId);
  if (!church) {
    return NextResponse.json(
      { ok: false, error: "Choose one of your hub's churches." },
      { status: 400 },
    );
  }
  const result = await claimPartnerForHub({
    hubId: session.hubId,
    hubLabel: session.hubLabel,
    country: await getHubCountry(session.hubId),
    partnerId,
    church: { id: church.id, name: church.name },
  });
  if (result.ok) return NextResponse.json({ ok: true, name: result.name });
  return NextResponse.json(
    {
      ok: false,
      error:
        result.reason === "taken"
          ? "Another hub has already claimed this giver. Ask the BENMP office if they belong to you."
          : "This giver is not available to your hub.",
    },
    { status: 409 },
  );
}
