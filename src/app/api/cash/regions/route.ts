import { NextResponse } from "next/server";
import { listAllRegions } from "@/lib/cash/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const regions = await listAllRegions();
    return NextResponse.json({ ok: true, regions });
  } catch (err) {
    console.error("[cash/regions] failed", err);
    return NextResponse.json({ ok: false, error: "Could not load regions." }, { status: 500 });
  }
}