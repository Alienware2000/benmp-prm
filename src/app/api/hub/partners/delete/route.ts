import { NextRequest, NextResponse } from "next/server";
import { deleteHubPartners } from "@/lib/hub/db";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

/**
 * Remove partners the signed-in hub uploaded (Decision 0029). The hub comes
 * from the session, never the body, so a hub can only ever remove its own.
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
  const body = (await req.json().catch(() => ({}))) as { partnerIds?: unknown };
  const ids = Array.isArray(body.partnerIds)
    ? body.partnerIds.filter(
        (x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x),
      )
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nothing selected." },
      { status: 400 },
    );
  }
  const result = await deleteHubPartners(session.hubId, session.hubLabel, ids);
  return NextResponse.json({
    ok: true,
    deleted: result.deleted,
    kept: result.kept.filter((k) => k.name !== ""),
  });
}
