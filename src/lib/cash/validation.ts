// src/lib/cash/validation.ts

export type GiverRowInput = {
  name: string;
  phone: string;
  amountMinor: number;
  transactionRef: string;
};

export type SubmitPayload = {
  regionCode: string;
  hubId: string;
  churchId: string;
  reportingMonth: string;
  summary: {
    totalRegistered: number;
    activePartners: number;
    newRegistrations: number;
    lapsed: number;
  };
  givers: GiverRowInput[];
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

export function validateGiverRow(row: GiverRowInput): ValidationResult {
  const hasName = row.name.trim().length >= 2;
  const hasPhone = row.phone.trim().length > 0;
  if (!hasName && !hasPhone) {
    return { ok: false, error: "Each giver row must have a name (≥ 2 chars) or a phone number to identify them." };
  }
  if (row.amountMinor <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }
  return { ok: true };
}

export function validateGiverRows(rows: GiverRowInput[]): ValidationResult {
  if (rows.length === 0) {
    return { ok: false, error: "At least one giver row is required." };
  }
  for (let i = 0; i < rows.length; i++) {
    const rowResult = validateGiverRow(rows[i]);
    if (!rowResult.ok) {
      return { ok: false, error: `Row ${i + 1}: ${rowResult.error}` };
    }
  }
  const seenRefs = new Set<string>();
  for (const row of rows) {
    const ref = row.transactionRef.trim();
    if (!ref) continue;
    if (seenRefs.has(ref)) {
      return { ok: false, error: `Duplicate transaction reference: "${ref}".` };
    }
    seenRefs.add(ref);
  }
  return { ok: true };
}

export function validateSummaryCounts(summary: SubmitPayload["summary"]): ValidationResult {
  const { totalRegistered, activePartners, newRegistrations, lapsed } = summary;
  if (totalRegistered < 0 || activePartners < 0 || newRegistrations < 0 || lapsed < 0) {
    return { ok: false, error: "Summary counts cannot be negative." };
  }
  return { ok: true };
}