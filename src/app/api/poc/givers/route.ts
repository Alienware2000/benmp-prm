import { NextRequest, NextResponse } from "next/server";
import { getHubSummary } from "@/lib/hub/db";
import { giverContactsResponse } from "@/lib/hub/giver-export";

export const dynamic = "force-dynamic";

/**
 * Staff. GET ?hubId=&month=YYYY-MM[&churchId=] — a hub's (or one church's)
 * givers for the month as a contact CSV (Decision 0041).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const hubId = params.get("hubId") ?? "";
  const hub = hubId ? await getHubSummary(hubId) : null;
  if (!hub) {
    return NextResponse.json(
      { ok: false, error: "Hub not found." },
      { status: 404 },
    );
  }
  return giverContactsResponse({
    by: "office",
    hubId,
    hubLabel: hub.hubLabel,
    churchId: params.get("churchId"),
    month: params.get("month"),
  });
}
