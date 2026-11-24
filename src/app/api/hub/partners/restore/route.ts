import { NextRequest, NextResponse } from "next/server";
import { restoreHubPartners } from "@/lib/hub/db";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

/**
 * Put back members a Monthly Summary Form marked Remove (Decision 0047). The
 * hub comes from the session, never the body, so a hub only restores its own.
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
  const restored = await restoreHubPartners(session.hubId, ids);
  console.info(
    JSON.stringify({ event: "hub_partner_restore", hubId: session.hubId, restored }),
  );
  return NextResponse.json({ ok: true, restored });
}
