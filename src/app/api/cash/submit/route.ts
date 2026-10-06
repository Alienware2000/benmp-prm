// src/app/api/cash/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  insertSubmission,
  listAllRegions,
  submissionExistsForMonth,
  validateChain,
  type GiverInsert,
  type SubmissionInsert,
} from "@/lib/cash/db";
import {
  parseReportingMonth,
  validateGiverRows,
  validateSummaryCounts,
  type SubmitPayload,
} from "@/lib/cash/validation";
import { checkRateLimit, type RateLimitMap } from "@/lib/cash/rate-limit";

export const dynamic = "force-dynamic";

const rateLimitMap: RateLimitMap = new Map();
const MAX_SUBMISSIONS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(rateLimitMap, ip, MAX_SUBMISSIONS, WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let body: SubmitPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const reportingMonth = parseReportingMonth(body.reportingMonth);
  if (!reportingMonth) {
    return NextResponse.json({ ok: false, error: "Invalid or future reporting month." }, { status: 400 });
  }

  const chainValid = await validateChain(body.regionCode, body.hubId, body.churchId);
  if (!chainValid) {
    return NextResponse.json(
      { ok: false, error: "The selected region, hub, or church is not valid." },
      { status: 400 },
    );
  }

  const exists = await submissionExistsForMonth(body.churchId, reportingMonth);
  if (exists) {
    return NextResponse.json({ ok: false, error: "already_submitted" }, { status: 409 });
  }

  const summaryResult = validateSummaryCounts(body.summary);
  if (!summaryResult.ok) {
    return NextResponse.json({ ok: false, error: summaryResult.error }, { status: 400 });
  }

  const giversResult = validateGiverRows(body.givers);
  if (!giversResult.ok) {
    return NextResponse.json({ ok: false, error: giversResult.error }, { status: 400 });
  }

  const regions = await listAllRegions();
  const region = regions.find((r) => r.code === body.regionCode);
  if (!region) {
    return NextResponse.json({ ok: false, error: "Region not found." }, { status: 400 });
  }

  const totalCashMinor = body.givers.reduce((sum, g) => sum + g.amountMinor, 0);
  const submission: SubmissionInsert = {
    region_id: region.id,
    hub_id: body.hubId,
    church_id: body.churchId,
    reporting_month: reportingMonth,
    total_registered: body.summary.totalRegistered,
    active_partners: body.summary.activePartners,
    new_registrations: body.summary.newRegistrations,
    lapsed: body.summary.lapsed,
    total_cash_minor: totalCashMinor,
    currency: "GHS",
  };
  const giverInserts: GiverInsert[] = body.givers.map((g, i) => ({
    row_index: i,
    giver_name: g.name.trim() || null,
    giver_phone: g.phone.trim() || null,
    amount_minor: g.amountMinor,
    transaction_ref: g.transactionRef.trim() || null,
  }));

  try {
    const submissionId = await insertSubmission(submission, giverInserts);
    return NextResponse.json({ ok: true, submissionId }, { status: 201 });
  } catch (err) {
    console.error("[cash/submit] insert failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not save the submission." },
      { status: 500 },
    );
  }
}