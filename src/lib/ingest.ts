/**
 * CSV ingestion for the Ghana/MoMo POC — turns raw parsed rows (from papaparse at
 * the file edge) into the typed RegistrationRow[] / PaymentRow[] that reconcile()
 * consumes. Pure, no I/O; column mapping is config so the office's real headers
 * stay out of code. See docs/poc-phases.md (POC-1) for the acceptance contract and
 * the real data quirks this handles.
 *
 * Money is integer minor units end-to-end — never parseFloat an amount.
 */

import type { RegistrationRow, PaymentRow } from "./reconcile";

export type RawRow = Record<string, string>;

export type Reject = { index: number; reason: string };
export type RegistrationParseResult = { rows: RegistrationRow[]; rejects: Reject[] };
export type PaymentParseResult = {
  rows: PaymentRow[];
  rejects: Reject[];
  duplicates: Reject[];
};

export type RegistrationColumnMap = {
  /** Optional source id column; a stable `reg_<index>` id is generated when absent. */
  id?: string;
  fullName: string;
  phone: string;
  expectedAmount?: string;
};

export type PaymentColumnMap = {
  reference: string;
  payerName?: string;
  payerPhone?: string;
  amount: string;
  currency?: string;
  paidAt?: string;
};

/**
 * Parse a money string to integer minor units (default 2 decimals, e.g. GHS pesewas).
 * Handles "120", "120.00", "12.5", "1,200.50", "GHS 50.00". Returns null for junk,
 * empty, negative, or over-precise values (more fractional digits than `decimals`) —
 * over-precision is rejected, not silently truncated, to protect the reconciliation.
 * Never uses floating-point arithmetic.
 */
export function parseAmountToMinor(raw: string, decimals = 2): number | null {
  if (raw == null) return null;
  // Drop grouping commas and anything that isn't a digit, dot, or minus (e.g. "GHS ").
  const s = String(raw).trim().replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-" || s === ".") return null;
  if (s.startsWith("-")) return null; // payments are never negative

  const parts = s.split(".");
  if (parts.length > 2) return null;
  const intPart = parts[0];
  const fracRaw = parts[1] ?? "";
  if (!/^\d+$/.test(intPart)) return null;
  if (fracRaw !== "" && !/^\d+$/.test(fracRaw)) return null;
  if (fracRaw.length > decimals) return null;

  const frac = fracRaw.padEnd(decimals, "0");
  const minor = Number(intPart) * 10 ** decimals + Number(frac);
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * Collapse an exactly-doubled name (MTN Ghana reports the sender twice, e.g.
 * "KWAME MENSAH KWAME MENSAH"). Leaves normal names untouched.
 */
export function collapseDoubledName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(" ");
    const second = words.slice(half).join(" ");
    if (first.toLowerCase() === second.toLowerCase()) return first;
  }
  return words.join(" ");
}

/** Parse registration rows. A row needs a name AND a phone; incomplete rows are rejected, never dropped silently. */
export function parseRegistrations(
  rows: RawRow[],
  map: RegistrationColumnMap,
): RegistrationParseResult {
  const out: RegistrationRow[] = [];
  const rejects: Reject[] = [];

  rows.forEach((row, index) => {
    const fullName = (row[map.fullName] ?? "").trim();
    if (!fullName) {
      rejects.push({ index, reason: "missing name" });
      return;
    }
    const phone = (row[map.phone] ?? "").trim();
    if (!phone) {
      rejects.push({ index, reason: "missing phone" });
      return;
    }
    const idFromCol = map.id ? (row[map.id] ?? "").trim() : "";
    const expectedAmountMinor = map.expectedAmount
      ? parseAmountToMinor(row[map.expectedAmount] ?? "")
      : null;
    out.push({
      id: idFromCol || `reg_${index}`,
      fullName,
      phone,
      expectedAmountMinor,
    });
  });

  return { rows: out, rejects };
}

/** Parse payment rows. Deduped by `reference` (the MoMo Transaction ID); invalid amounts and missing references are rejected. */
export function parsePayments(
  rows: RawRow[],
  map: PaymentColumnMap,
): PaymentParseResult {
  const out: PaymentRow[] = [];
  const rejects: Reject[] = [];
  const duplicates: Reject[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const reference = (row[map.reference] ?? "").trim();
    if (!reference) {
      rejects.push({ index, reason: "missing reference" });
      return;
    }
    if (seen.has(reference)) {
      duplicates.push({ index, reason: `duplicate reference ${reference}` });
      return;
    }
    seen.add(reference);

    const rawAmount = row[map.amount] ?? "";
    const amountMinor = parseAmountToMinor(rawAmount);
    if (amountMinor == null) {
      rejects.push({ index, reason: `invalid amount: ${rawAmount || "(empty)"}` });
      return;
    }

    const payerName = map.payerName
      ? collapseDoubledName((row[map.payerName] ?? "").trim()) || null
      : null;
    const payerPhone = map.payerPhone ? (row[map.payerPhone] ?? "").trim() || null : null;
    const currency = (map.currency ? (row[map.currency] ?? "").trim() : "") || "GHS";
    const paidAt = map.paidAt ? (row[map.paidAt] ?? "").trim() : "";

    out.push({ reference, payerName, payerPhone, amountMinor, currency, paidAt });
  });

  return { rows: out, rejects, duplicates };
}
