// src/app/api/cash/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  deleteSubmission,
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
  type NewMemberInput,
  type SubmitPayload,
} from "@/lib/cash/validation";
import { addNewMembers, checkNewMembers, nonBlankMembers } from "@/lib/cash/new-members";
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
 * The Monthly Summary Form (Decision 0039). Multipart: `regionCode`, `hubId`,
 * `churchId`, `reportingMonth`, `summary` (JSON, the four required numbers),
 * `members` (JSON, optional new members) and, in Ghana regions only, the
 * optional cash parts: `file` (giver sheet, CSV or Excel, re-read here rather
 * than trusted from the preview) and `deposits` (JSON array). Everything is
 * checked before anything is written.
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
      totalRegistered: null,
      activePartners: null,
      newRegistrations: null,
      lapsed: null,
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

  const regions = await listAllRegions();
  const region = regions.find((r) => r.code === body.regionCode);
  if (!region) {
    return NextResponse.json({ ok: false, error: "Region not found." }, { status: 400 });
  }
  // Cash is reported in the Ghana regions only, and is optional there.
  const reportsCash = region.momo_required;

  let givers: { name: string; phone: string; amountMinor: number; transactionRef: string }[] = [];
  let upload: { filename: string; buffer: ArrayBuffer } | null = null;
  const file = form.get("file");
  if (reportsCash && file && typeof file !== "string" && file.size > 0) {
    const read = await readGiverUpload(file);
    if (!read.ok) {
      return NextResponse.json({ ok: false, error: read.error }, { status: 400 });
    }
    if (read.result.errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Fix the giver list and upload it again. ${read.result.errors.slice(0, 5).join(" ")}` },
        { status: 400 },
      );
    }
    const giversResult = validateGiverRows(read.result.givers);
    if (!giversResult.ok) {
      return NextResponse.json({ ok: false, error: giversResult.error }, { status: 400 });
    }
    givers = read.result.givers;
    upload = { filename: read.filename, buffer: read.buffer };
  }

  if (!reportsCash) body.deposits = [];
  const depositsResult = validateDeposits(body.deposits, reportingMonth);
  if (!depositsResult.ok) {
    return NextResponse.json({ ok: false, error: depositsResult.error }, { status: 400 });
  }
  const depositKeys = body.deposits.map((d) => transactionIdKey(d.transactionId));
  const alreadyReported = depositKeys.length > 0 ? await reportedTransactionKeys(depositKeys) : [];
  if (alreadyReported.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Transaction ID already reported on another form: ${alreadyReported.join(", ")}.` },
      { status: 409 },
    );
  }

  const members = nonBlankMembers(parseJson<NewMemberInput[]>(form.get("members"), []));
  const memberCheck =
    members.length > 0
      ? await checkNewMembers(members, { hubId: body.hubId, churchId: body.churchId, momoRequired: reportsCash })
      : null;
  if (memberCheck && !memberCheck.ok) {
    return NextResponse.json(
      { ok: false, error: memberCheck.error, memberIssues: memberCheck.rows },
      { status: 400 },
    );
  }

  // Keep a giver sheet in the statement vault (migration 0024) beside the bank statements.
  let vaultPath: string | null = null;
  if (upload) {
    const fileHash = computeFileHash(upload.buffer);
    vaultPath = vaultObjectPath({
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
  }

  const totalCashMinor = givers.reduce((sum, g) => sum + g.amountMinor, 0);
  const depositsTotalMinor = body.deposits.reduce((sum, d) => sum + d.amountMinor, 0);
  const submission: SubmissionInsert = {
    region_id: region.id,
    hub_id: body.hubId,
    church_id: body.churchId,
    reporting_month: reportingMonth,
    total_registered: body.summary.totalRegistered!,
    active_partners: body.summary.activePartners!,
    new_registrations: body.summary.newRegistrations!,
    lapsed: body.summary.lapsed!,
    total_cash_minor: totalCashMinor,
    deposits_total_minor: depositsTotalMinor,
    currency: "GHS",
    givers_file_path: vaultPath,
    givers_file_name: upload?.filename ?? null,
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

  let submissionId: string;
  try {
    submissionId = await insertSubmission(submission, giverInserts, depositInserts);
  } catch (err) {
    console.error("[cash/submit] insert failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not save the submission." },
      { status: 500 },
    );
  }

  // New members last: if adding them fails, the form is taken back out so the
  // church can submit again instead of hitting "already submitted".
  let membersAdded = 0;
  if (memberCheck?.ok && memberCheck.add.length > 0) {
    try {
      await addNewMembers(memberCheck.add, {
        hubId: body.hubId,
        hubCountry: memberCheck.hubCountry,
        reportingMonth,
      });
      membersAdded = memberCheck.add.length;
    } catch (err) {
      console.error("[cash/submit] adding new members failed", err);
      await deleteSubmission(submissionId).catch(() => {});
      return NextResponse.json(
        { ok: false, error: "Could not add the new members. Nothing was saved; please submit again." },
        { status: 500 },
      );
    }
  }

  console.info(
    JSON.stringify({
      event: "cash_submission",
      submissionId,
      churchId: body.churchId,
      reportingMonth,
      summary: body.summary,
      givers: giverInserts.length,
      totalCashMinor,
      deposits: depositInserts.length,
      depositsTotalMinor,
      transactionKeys: depositKeys,
      vaultPath,
      membersAdded,
      membersAlreadyListed: memberCheck?.ok ? memberCheck.alreadyListed : 0,
    }),
  );
  return NextResponse.json(
    {
      ok: true,
      submissionId,
      totalCashMinor,
      depositsTotalMinor,
      membersAdded,
      membersAlreadyListed: memberCheck?.ok ? memberCheck.alreadyListed : 0,
    },
    { status: 201 },
  );
}
