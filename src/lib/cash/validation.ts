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
 * The month's cash, typed as one total (Ghana regions only, optional). Blank is
 * no cash; anything given must be a positive amount with at most two decimals.
 * Returns pesewas.
 */
export function parseCashTotal(raw: string): { ok: true; minor: number } | { ok: false; error: string } {
  const value = raw.trim().replace(/,/g, "");
  if (value === "") return { ok: true, minor: 0 };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { ok: false, error: "Enter the cash total as an amount in GHS, e.g. 1250.50." };
  }
  const minor = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(minor)) return { ok: false, error: "The cash total is too large." };
  return { ok: true, minor };
}
