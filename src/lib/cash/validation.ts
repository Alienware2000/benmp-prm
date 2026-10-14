// src/lib/cash/validation.ts

export type GiverRowInput = {
  name: string;
  phone: string;
  amountMinor: number;
  transactionRef: string;
};

/** How the month's cash reached BENMP — one row per transfer, so it can be traced. */
export type DepositChannel = "momo" | "bank" | "other";
export const DEPOSIT_CHANNELS: DepositChannel[] = ["momo", "bank", "other"];

export type DepositInput = {
  transactionId: string;
  channel: DepositChannel;
  amountMinor: number;
  /** YYYY-MM-DD */
  depositedOn: string;
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
  deposits: DepositInput[];
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
/** Uppercased, internal whitespace removed — how a transaction ID is compared. */
export const transactionIdKey = (id: string) => id.replace(/\s+/g, "").toUpperCase();

/**
 * The transfers that carried the month's cash to BENMP. At least one is required.
 * A deposit may land after the month closes, so the date runs from the start of the
 * reporting month (`YYYY-MM-01`) to today.
 */
export function validateDeposits(deposits: DepositInput[], reportingMonth: string, today = new Date()): ValidationResult {
  if (!Array.isArray(deposits) || deposits.length === 0) {
    return { ok: false, error: "Add at least one transaction ID for the month's cash." };
  }
  const todayIso = today.toISOString().slice(0, 10);
  const seen = new Set<string>();
  for (let i = 0; i < deposits.length; i++) {
    const d = deposits[i];
    const label = `Transaction ${i + 1}`;
    const key = transactionIdKey(String(d.transactionId ?? ""));
    if (key.length < 4) return { ok: false, error: `${label}: enter the transaction ID (at least 4 characters).` };
    if (seen.has(key)) return { ok: false, error: `${label}: transaction ID "${d.transactionId}" is listed twice.` };
    seen.add(key);
    if (!DEPOSIT_CHANNELS.includes(d.channel)) return { ok: false, error: `${label}: choose MoMo, Bank, or Other.` };
    if (!Number.isSafeInteger(d.amountMinor) || d.amountMinor <= 0) {
      return { ok: false, error: `${label}: amount must be greater than zero.` };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.depositedOn ?? "") || isNaN(Date.parse(d.depositedOn))) {
      return { ok: false, error: `${label}: enter the transaction date.` };
    }
    if (d.depositedOn < reportingMonth || d.depositedOn > todayIso) {
      return { ok: false, error: `${label}: the date must be between the start of the reporting month and today.` };
    }
  }
  return { ok: true };
}
