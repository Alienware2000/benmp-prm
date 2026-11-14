import { NextRequest, NextResponse } from "next/server";
import { giverContactsResponse } from "@/lib/hub/giver-export";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

/**
 * GET ?month=YYYY-MM[&churchId=] — the signed-in hub's givers for the month as
 * a contact CSV (Decision 0041). Always the session's own hub.
 */
export async function GET(req: NextRequest) {
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
  const params = req.nextUrl.searchParams;
  return giverContactsResponse({
    by: "hub",
    hubId: session.hubId,
    hubLabel: session.hubLabel,
    churchId: params.get("churchId"),
    month: params.get("month"),
  });
}
