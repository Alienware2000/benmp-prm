import { NextRequest, NextResponse } from "next/server";
import { updateHubLeaderName } from "@/lib/hub/db";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

/**
 * Update the hub's own editable account details (HP settings). Currently the
 * leader/contact name — the hub number is the identity and never changes.
 */
export async function PATCH(req: NextRequest) {
  const session = await verifyHubSessionToken(
    req.cookies.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { leaderName?: unknown };
  const leaderName =
    typeof body.leaderName === "string" ? body.leaderName.trim() : "";
  if (leaderName.length < 2 || leaderName.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Enter the leader's name (2–80 characters)." },
      { status: 400 },
    );
  }

  await updateHubLeaderName(session.hubId, leaderName);
  return NextResponse.json({ ok: true, leaderName });
}
