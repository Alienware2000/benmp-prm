// src/app/api/cash/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  insertSubmission,
  listAllRegions,
  reportedTransactionKeys,
  submissionExistsForMonth,
  validateChain,
  type DepositInsert,
  type GiverInsert,
  type SubmissionInsert,
} from "@/lib/cash/db";
import {
  parseReportingMonth,
  transactionIdKey,
  validateDeposits,
  validateGiverRows,
  validateSummaryCounts,
  type DepositInput,
  type SubmitPayload,
} from "@/lib/cash/validation";
import { readGiverUpload } from "@/lib/cash/giver-upload";
import { checkRateLimit, type RateLimitMap } from "@/lib/cash/rate-limit";
import { computeFileHash } from "@/lib/poc/import-dedup";
import { contentTypeFor, vaultObjectPath } from "@/lib/poc/statement-file";
import { saveStatementFile } from "@/lib/poc/statement-vault";

export const dynamic = "force-dynamic";

const rateLimitMap: RateLimitMap = new Map();
const MAX_SUBMISSIONS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Multipart form: `regionCode`, `hubId`, `churchId`, `reportingMonth`, `summary`
 * (JSON), `deposits` (JSON array) and `file` (the giver sheet, CSV or Excel). The
 * sheet is re-read here, never taken from the browser's preview.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(rateLimitMap, ip, MAX_SUBMISSIONS, WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form submission." }, { status: 400 });
  }
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const body: Omit<SubmitPayload, "givers"> = {
    regionCode: field("regionCode"),
    hubId: field("hubId"),
    churchId: field("churchId"),
    reportingMonth: field("reportingMonth"),
    summary: parseJson(form.get("summary"), {
      totalRegistered: 0,
      activePartners: 0,
      newRegistrations: 0,
      lapsed: 0,
    }),
    deposits: parseJson<DepositInput[]>(form.get("deposits"), []),
  };

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

  const upload = await readGiverUpload(form.get("file"));
  if (!upload.ok) {
    return NextResponse.json({ ok: false, error: upload.error }, { status: 400 });
  }
  const { givers, errors: fileErrors } = upload.result;
  if (fileErrors.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Fix the giver list and upload it again. ${fileErrors.slice(0, 5).join(" ")}` },
      { status: 400 },
    );
  }
  const giversResult = validateGiverRows(givers);
  if (!giversResult.ok) {
    return NextResponse.json({ ok: false, error: giversResult.error }, { status: 400 });
  }

  const depositsResult = validateDeposits(body.deposits, reportingMonth);
  if (!depositsResult.ok) {
    return NextResponse.json({ ok: false, error: depositsResult.error }, { status: 400 });
  }
  const depositKeys = body.deposits.map((d) => transactionIdKey(d.transactionId));
  const alreadyReported = await reportedTransactionKeys(depositKeys);
  if (alreadyReported.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Transaction ID already reported on another cash form: ${alreadyReported.join(", ")}.` },
      { status: 409 },
    );
  }

  const regions = await listAllRegions();
  const region = regions.find((r) => r.code === body.regionCode);
  if (!region) {
    return NextResponse.json({ ok: false, error: "Region not found." }, { status: 400 });
  }

  // Keep the branch's original sheet in the statement vault (migration 0024) beside the bank statements.
  const fileHash = computeFileHash(upload.buffer);
  const vaultPath = vaultObjectPath({
    source: "cash",
    month: reportingMonth.slice(0, 7),
    fileHash,
    filename: upload.filename,
  });
  try {
    await saveStatementFile(vaultPath, upload.buffer, contentTypeFor(upload.filename));
  } catch (err) {
    console.error("[cash/submit] vault save failed", err);
    return NextResponse.json({ ok: false, error: "Could not save the giver list. Please try again." }, { status: 500 });
  }

  const totalCashMinor = givers.reduce((sum, g) => sum + g.amountMinor, 0);
  const depositsTotalMinor = body.deposits.reduce((sum, d) => sum + d.amountMinor, 0);
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
    deposits_total_minor: depositsTotalMinor,
    currency: "GHS",
    givers_file_path: vaultPath,
    givers_file_name: upload.filename,
  };
  const giverInserts: GiverInsert[] = givers.map((g, i) => ({
    row_index: i,
    giver_name: g.name.trim() || null,
    giver_phone: g.phone.trim() || null,
    amount_minor: g.amountMinor,
    transaction_ref: g.transactionRef.trim() || null,
  }));
  const depositInserts: DepositInsert[] = body.deposits.map((d, i) => ({
    row_index: i,
    transaction_id: d.transactionId.trim(),
    transaction_key: depositKeys[i],
    channel: d.channel,
    amount_minor: d.amountMinor,
    deposited_on: d.depositedOn,
  }));

  try {
    const submissionId = await insertSubmission(submission, giverInserts, depositInserts);
    console.info(
      JSON.stringify({
        event: "cash_submission",
        submissionId,
        churchId: body.churchId,
        reportingMonth,
        givers: giverInserts.length,
        totalCashMinor,
        deposits: depositInserts.length,
        depositsTotalMinor,
        transactionKeys: depositKeys,
        vaultPath,
      }),
    );
    return NextResponse.json(
      { ok: true, submissionId, totalCashMinor, depositsTotalMinor },
      { status: 201 },
    );
  } catch (err) {
    console.error("[cash/submit] insert failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not save the submission." },
      { status: 500 },
    );
  }
}
