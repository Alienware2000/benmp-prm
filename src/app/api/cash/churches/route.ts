import { NextRequest, NextResponse } from "next/server";
import { listChurchesInHub } from "@/lib/cash/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const hubId = req.nextUrl.searchParams.get("hubId");
  if (!hubId) {
    return NextResponse.json({ ok: false, error: "Missing hubId." }, { status: 400 });
  }
  try {
    const churches = await listChurchesInHub(hubId);
    return NextResponse.json({ ok: true, churches });
  } catch (err) {
    console.error("[cash/churches] failed", err);
    return NextResponse.json({ ok: false, error: "Could not load churches." }, { status: 500 });
  }
}