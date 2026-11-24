// src/app/api/cash/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  deleteSubmission,
  insertMemberMarks,
  insertSubmission,
  listAllRegions,
  listChurchMembers,
  removeMembers,
  restoreRemovedBy,
  submissionExistsForMonth,
  validateChain,
  type SubmissionInsert,
} from "@/lib/cash/db";
import {
  parseGivenUsd,
  parseReportingMonth,
  validateMemberMarks,
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
 * The Monthly Summary Form (Decisions 0039, 0043, 0047). Multipart: `regionCode`,
 * `hubId`, `churchId`, `reportingMonth`, `summary` (JSON, the four required
 * numbers), `givenUsd` (required, the month's giving in US dollars), `marks`
 * (JSON `[{ partnerId, status }]`, one for every member on the church's list:
 * active | new | lapsed | remove) and `members` (JSON, optional new members).
 * Everything is checked before anything is written.
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
  // Ghana regions also collect a MoMo number for new members (Decision 0026).
  const reportsCash = region.momo_required;

  const given = parseGivenUsd(field("givenUsd"));
  if (!given.ok) {
    return NextResponse.json({ ok: false, error: given.error }, { status: 400 });
  }

  const churchMembers = await listChurchMembers(body.churchId);
  const marks = validateMemberMarks(
    parseJson<unknown>(form.get("marks"), []),
    churchMembers.map((m) => m.id),
  );
  if (!marks.ok) {
    return NextResponse.json(
      { ok: false, error: marks.error, unmarked: marks.unmarked ?? [] },
      { status: 400 },
    );
  }
  const removals = [...marks.marks].filter(([, s]) => s === "remove").map(([id]) => id);

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
    total_cash_minor: 0,
    given_usd_cents: given.cents,
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

  // Marks, then removals (stamped, never deleted). If anything after the form
  // fails, the removals are restored and the form taken back out (its marks go
  // with it), so the church can submit again instead of hitting "already submitted".
  const undo = async () => {
    await restoreRemovedBy(submissionId).catch(() => {});
    await deleteSubmission(submissionId).catch(() => {});
  };
  try {
    await insertMemberMarks(submissionId, marks.marks);
    if (removals.length > 0) await removeMembers(removals, submissionId);
  } catch (err) {
    console.error("[cash/submit] saving member marks failed", err);
    await undo();
    return NextResponse.json(
      { ok: false, error: "Could not save the member marks. Nothing was saved; please submit again." },
      { status: 500 },
    );
  }

  // New members last.
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
      await undo();
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
      givenUsdCents: given.cents,
      marks: Object.fromEntries(
        ["active", "new", "lapsed", "remove"].map((k) => [k, [...marks.marks.values()].filter((v) => v === k).length]),
      ),
      removed: removals,
      membersAdded,
      membersAlreadyListed: memberCheck?.ok ? memberCheck.alreadyListed : 0,
    }),
  );
  return NextResponse.json(
    {
      ok: true,
      submissionId,
      givenUsdCents: given.cents,
      membersRemoved: removals.length,
      membersAdded,
      membersAlreadyListed: memberCheck?.ok ? memberCheck.alreadyListed : 0,
    },
    { status: 201 },
  );
}
