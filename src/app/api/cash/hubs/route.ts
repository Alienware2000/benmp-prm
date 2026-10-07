import { NextRequest, NextResponse } from "next/server";
import { listHubsInRegion } from "@/lib/cash/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const regionCode = req.nextUrl.searchParams.get("regionCode");
  if (!regionCode) {
    return NextResponse.json({ ok: false, error: "Missing regionCode." }, { status: 400 });
  }
  try {
    const hubs = await listHubsInRegion(regionCode);
    return NextResponse.json({ ok: true, hubs });
  } catch (err) {
    console.error("[cash/hubs] failed", err);
    return NextResponse.json({ ok: false, error: "Could not load hubs." }, { status: 500 });
  }
}