// src/app/api/cash/preview/route.ts
// Public: reads an attached giver sheet and returns what was understood, without
// saving anything, so the branch can check it before submitting.
import { NextRequest, NextResponse } from "next/server";
import { readGiverUpload } from "@/lib/cash/giver-upload";
import { checkRateLimit, type RateLimitMap } from "@/lib/cash/rate-limit";

export const dynamic = "force-dynamic";

const rateLimitMap: RateLimitMap = new Map();

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(rateLimitMap, ip, 30, 15 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Attach the giver list (Excel or CSV)." },
      { status: 400 },
    );
  }
  const upload = await readGiverUpload(form.get("file"));
  if (!upload.ok)
    return NextResponse.json(
      { ok: false, error: upload.error },
      { status: 400 },
    );
  const { givers, errors } = upload.result;
  return NextResponse.json({
    ok: true,
    givers,
    errors,
    totalMinor: givers.reduce((sum, g) => sum + g.amountMinor, 0),
  });
}
