// src/lib/cash/validation.ts

/** A new member to add to the church's partner list from the form. */
export type NewMemberInput = {
  name: string;
  whatsappPhone: string;
  /** Ghana regions only; "" elsewhere. */
  momoPhone: string;
};

/** Most new members one form can add; a bigger list belongs in the hub's Upload tab. */
export const MAX_NEW_MEMBERS = 50;

export type SubmitPayload = {
  regionCode: string;
  hubId: string;
  churchId: string;
  reportingMonth: string;
  /** The four monthly numbers; all required (null = left blank). */
  summary: {
    totalRegistered: number | null;
    activePartners: number | null;
    newRegistrations: number | null;
    lapsed: number | null;
  };
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Parse "YYYY-MM" into a "YYYY-MM-01" date string, or null if invalid/future. */
export function parseReportingMonth(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const date = new Date(Date.UTC(year, month - 1, 1));
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (date > currentMonthStart) return null;
  return `${match[1]}-${match[2]}-01`;
}

const SUMMARY_LABELS: Record<keyof SubmitPayload["summary"], string> = {
  totalRegistered: "Total registered",
  activePartners: "Active partners",
  newRegistrations: "New registrations",
  lapsed: "Lapsed",
};

/** The monthly summary is the compulsory part of the form: all four whole numbers, none negative. */
export function validateSummaryCounts(summary: SubmitPayload["summary"]): ValidationResult {
  for (const key of Object.keys(SUMMARY_LABELS) as (keyof SubmitPayload["summary"])[]) {
    const value = summary?.[key];
    if (value === null || value === undefined || !Number.isInteger(value)) {
      return { ok: false, error: `Fill in "${SUMMARY_LABELS[key]}" in the monthly summary.` };
    }
    if (value < 0) return { ok: false, error: `"${SUMMARY_LABELS[key]}" cannot be negative.` };
  }
  return { ok: true };
}

/**
 * The church's BENMP giving for the month as a US-dollar equivalent (Decision
 * 0047): required of every church, zero allowed, at most two decimals. Returns
 * cents. Stored in `cash_submissions.given_usd_cents`.
 */
export function parseGivenUsd(raw: string): { ok: true; cents: number } | { ok: false; error: string } {
  const value = raw.trim().replace(/[,$\s]/g, "");
  if (value === "") {
    return { ok: false, error: "Enter the amount given this month in US dollars (0 if nothing was given)." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { ok: false, error: "Enter the amount given as US dollars, e.g. 1250.50." };
  }
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents)) return { ok: false, error: "The amount given is too large." };
  return { ok: true, cents };
}

/** How a church marks each of its members on the month's form. */
export type MemberMark = "active" | "new" | "lapsed" | "remove";
export const MEMBER_MARKS: readonly MemberMark[] = ["active", "new", "lapsed", "remove"];

/**
 * Every member on the church's list (`memberIds`) must be marked exactly once,
 * and only those members. Returns the marks keyed by partner id.
 */
export function validateMemberMarks(
  marks: unknown,
  memberIds: string[],
): { ok: true; marks: Map<string, MemberMark> } | { ok: false; error: string; unmarked?: string[] } {
  if (!Array.isArray(marks)) return { ok: false, error: "The member marks could not be read." };
  const members = new Set(memberIds);
  const out = new Map<string, MemberMark>();
  for (const m of marks) {
    const id = (m as { partnerId?: unknown })?.partnerId;
    const status = (m as { status?: unknown })?.status;
    if (typeof id !== "string" || !members.has(id)) {
      return { ok: false, error: "Your church's member list has changed. Reload the form and mark the members again." };
    }
    if (!MEMBER_MARKS.includes(status as MemberMark)) {
      return { ok: false, error: "Mark each member as Active, New, Lapsed or Remove." };
    }
    if (out.has(id)) return { ok: false, error: "A member is marked twice." };
    out.set(id, status as MemberMark);
  }
  const unmarked = memberIds.filter((id) => !out.has(id));
  if (unmarked.length > 0) {
    return {
      ok: false,
      error: `Mark every member: ${unmarked.length} ${unmarked.length === 1 ? "is" : "are"} not marked yet.`,
      unmarked,
    };
  }
  return { ok: true, marks: out };
}
