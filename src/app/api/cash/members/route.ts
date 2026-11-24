import { NextRequest, NextResponse } from "next/server";
import { listChurchMembers } from "@/lib/cash/db";
import { checkRateLimit, type RateLimitMap } from "@/lib/cash/rate-limit";

export const dynamic = "force-dynamic";

const rateLimitMap: RateLimitMap = new Map();

/**
 * Public. GET ?churchId= — the church's members by name, for marking on the
 * Monthly Summary Form (Decision 0047). Names only; removed members left out.
 * Rate-limited per IP so the whole directory can't be pulled quickly.
 */
export async function GET(req: NextRequest) {
  const churchId = req.nextUrl.searchParams.get("churchId");
  if (!churchId || !/^[0-9a-f-]{36}$/i.test(churchId)) {
    return NextResponse.json({ ok: false, error: "Missing churchId." }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(rateLimitMap, ip, 60, 15 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }
  try {
    const members = await listChurchMembers(churchId);
    return NextResponse.json({ ok: true, members });
  } catch (err) {
    console.error("[cash/members] failed", err);
    return NextResponse.json({ ok: false, error: "Could not load the church's members." }, { status: 500 });
  }
}
