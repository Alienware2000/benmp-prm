// src/app/api/cash/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  deleteSubmission,
  insertSubmission,
  listAllRegions,
  submissionExistsForMonth,
  validateChain,
  type SubmissionInsert,
} from "@/lib/cash/db";
import {
  parseCashTotal,
  parseReportingMonth,
  validateSummaryCounts,
  type NewMemberInput,
  type SubmitPayload,
} from "@/lib/cash/validation";
import { addNewMembers, checkNewMembers, nonBlankMembers } from "@/lib/cash/new-members";
import { checkRateLimit, type RateLimitMap } from "@/lib/cash/rate-limit";

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
 * The Monthly Summary Form (Decisions 0039, 0043). Multipart: `regionCode`,
 * `hubId`, `churchId`, `reportingMonth`, `summary` (JSON, the four required
 * numbers), `members` (JSON, optional new members) and, in Ghana regions only,
 * `cashTotal` (optional, GHS). Everything is checked before anything is written.
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
  const body: SubmitPayload = {
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

  const cash = reportsCash ? parseCashTotal(field("cashTotal")) : { ok: true as const, minor: 0 };
  if (!cash.ok) {
    return NextResponse.json({ ok: false, error: cash.error }, { status: 400 });
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

  const submission: SubmissionInsert = {
    region_id: region.id,
    hub_id: body.hubId,
    church_id: body.churchId,
    reporting_month: reportingMonth,
    total_registered: body.summary.totalRegistered!,
    active_partners: body.summary.activePartners!,
    new_registrations: body.summary.newRegistrations!,
    lapsed: body.summary.lapsed!,
    total_cash_minor: cash.minor,
    deposits_total_minor: 0,
    currency: "GHS",
    givers_file_path: null,
    givers_file_name: null,
  };
  let submissionId: string;
  try {
    submissionId = await insertSubmission(submission);
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
      totalCashMinor: cash.minor,
      membersAdded,
      membersAlreadyListed: memberCheck?.ok ? memberCheck.alreadyListed : 0,
    }),
  );
  return NextResponse.json(
    {
      ok: true,
      submissionId,
      totalCashMinor: cash.minor,
      membersAdded,
      membersAlreadyListed: memberCheck?.ok ? memberCheck.alreadyListed : 0,
    },
    { status: 201 },
  );
}
