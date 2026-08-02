/**
 * Giving ledger — every recorded payment, filterable, with a total over the filtered set.
 *
 * The ledger is the payments table (the MoMo statement, immutable). Branch is NOT a
 * column on payments: it is resolved by matching payer_phone_e164 to a partner's
 * whatsapp_number and taking that partner's church. Some giving matches no partner at
 * all (givers who have never registered), so it is bucketed as UNATTRIBUTED rather than
 * dropped — a filtered total must always reconcile to the ledger total.
 *
 * Filtering and totalling are pure functions over the loaded ledger. The POC ledger is a
 * few hundred rows, so it is loaded once and filtered in memory; past a few thousand rows
 * this moves into SQL.
 */

import { normalizePhone } from "../phone";
import { isStatementRow } from "../reconcile";
import type { Fetcher } from "./db";
import { supabaseRestFetcher } from "./db";
import { branchLabel, isSensibleName } from "./directory";

/** Shown wherever a payment can't be tied to a known partner. */
export const UNATTRIBUTED = "Unattributed";

export type DbGivingPayment = {
  reference: string;
  payer_name: string | null;
  payer_phone_e164: string | null;
  amount_minor: number | string;
  currency: string | null;
  paid_at: string | null;
};

export type GivingEntry = {
  reference: string;
  /** Payer name from the statement, falling back to the matched partner's name. */
  name: string;
  phone: string | null;
  amountMinor: number;
  currency: string;
  /** ISO timestamp, or "" when the statement row carried no date. */
  paidAt: string;
  /** Date part only (YYYY-MM-DD) — what the date-range filter compares against. */
  paidOn: string;
  branch: string;
  country: string;
  /** True when the payer matched a partner record. */
  attributed: boolean;
  /**
   * Bank/interop artifact rather than a person (Decision 0008 §6). The money is real and
   * stays in every total; it is never counted as a giver and never messaged.
   */
  isStatement: boolean;
};

export type GivingFilters = {
  /** Inclusive YYYY-MM-DD lower bound. */
  from?: string;
  /** Inclusive YYYY-MM-DD upper bound. */
  to?: string;
  /** Case-insensitive substring match on the payer name. */
  name?: string;
  /** Inclusive lower gift amount in integer minor units. */
  minAmountMinor?: number;
  /** Inclusive upper gift amount in integer minor units. */
  maxAmountMinor?: number;
  /** Exact branch, including UNATTRIBUTED. */
  branch?: string;
};

export function toEntries(
  payments: DbGivingPayment[],
  branchByPhone: Map<string, { branch: string; name: string; country: string }>,
): GivingEntry[] {
  return payments.map((p) => {
    const phone = normalizePhone(p.payer_phone_e164);
    const match = phone ? branchByPhone.get(phone) : undefined;
    const paidAt = p.paid_at ?? "";
    return {
      reference: p.reference,
      // Same sense gate as the directory: a statement row whose payer is a code or a
      // number is not a person's name. Fall back to the matched partner before giving up.
      name: isSensibleName(p.payer_name)
        ? (p.payer_name ?? "").trim()
        : isSensibleName(match?.name)
          ? (match?.name ?? "").trim()
          : "Unknown",
      phone,
      amountMinor: Number(p.amount_minor),
      currency: p.currency ?? "GHS",
      paidAt,
      paidOn: paidAt.slice(0, 10),
      branch: match?.branch || UNATTRIBUTED,
      country: match?.country || "—",
      attributed: match !== undefined,
      isStatement: isStatementRow(p.payer_name),
    };
  });
}

/**
 * Apply the UI filters. Every filter is optional and they compose with AND, which is what
 * "filter the ledger down and show me the total" means to a finance user.
 */
export function filterGiving(
  entries: GivingEntry[],
  f: GivingFilters,
): GivingEntry[] {
  const name = (f.name ?? "").trim().toLowerCase();
  const branch = (f.branch ?? "").trim();
  const from = (f.from ?? "").trim();
  const to = (f.to ?? "").trim();
  const minAmount = f.minAmountMinor;
  const maxAmount = f.maxAmountMinor;

  return entries.filter((e) => {
    // A row with no date can't satisfy a date bound; excluding it keeps the total honest.
    if (from && (!e.paidOn || e.paidOn < from)) return false;
    if (to && (!e.paidOn || e.paidOn > to)) return false;
    if (minAmount !== undefined && e.amountMinor < minAmount) return false;
    if (maxAmount !== undefined && e.amountMinor > maxAmount) return false;
    if (branch && e.branch !== branch) return false;
    if (name && !e.name.toLowerCase().includes(name)) return false;
    return true;
  });
}

export type GivingTotals = {
  totalMinor: number;
  count: number;
  /**
   * Distinct people who gave. Bank/interop statement rows are excluded — counting
   * "Ecobank MobileApp" as a giver would overstate how many partners actually gave.
   */
  givers: number;
  /** Bank/interop rows in this set: real money, no person behind it. */
  statementCount: number;
  statementMinor: number;
  currency: string;
  byBranch: Array<{ branch: string; amountMinor: number; count: number }>;
};

/** Aggregate whatever the filters left — this is the number the page headlines. */
export function summarizeGiving(entries: GivingEntry[]): GivingTotals {
  let totalMinor = 0;
  let statementCount = 0;
  let statementMinor = 0;
  const givers = new Set<string>();
  const branches = new Map<string, { amountMinor: number; count: number }>();

  for (const e of entries) {
    totalMinor += e.amountMinor;
    if (e.isStatement) {
      statementCount += 1;
      statementMinor += e.amountMinor;
    } else {
      givers.add(e.phone ?? `name:${e.name.toLowerCase()}`);
    }
    const b = branches.get(e.branch) ?? { amountMinor: 0, count: 0 };
    b.amountMinor += e.amountMinor;
    b.count += 1;
    branches.set(e.branch, b);
  }

  return {
    totalMinor,
    count: entries.length,
    givers: givers.size,
    statementCount,
    statementMinor,
    currency: entries[0]?.currency ?? "GHS",
    byBranch: [...branches.entries()]
      .map(([branch, v]) => ({ branch, ...v }))
      .sort((a, b) => b.amountMinor - a.amountMinor),
  };
}

/** Newest gift first — a ledger is read from the most recent entry backwards. */
export function sortByDateDesc(entries: GivingEntry[]): GivingEntry[] {
  return [...entries].sort((a, b) =>
    a.paidAt > b.paidAt ? -1 : a.paidAt < b.paidAt ? 1 : 0,
  );
}

/**
 * Phone -> partner details for the numbers in this ledger. The directory is queried in
 * bounded chunks so a giving page never has to download the complete partner table.
 */
export async function loadPartnersForGivingPhones(
  phones: string[],
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<Map<string, { branch: string; name: string; country: string }>> {
  const unique = [
    ...new Set(phones.map((phone) => normalizePhone(phone)).filter(Boolean)),
  ] as string[];
  if (unique.length === 0) return new Map();

  const rows: Array<{
    full_name: string | null;
    whatsapp_number: string | null;
    church: string | null;
    country: string | null;
  }> = [];

  // A typical statement contains a few hundred distinct numbers. Query only those
  // partners rather than paging the complete 25k+ standing directory on every visit.
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100);
    const list = chunk.map((phone) => encodeURIComponent(phone)).join(",");
    const matches = await fetcher<{
      full_name: string | null;
      whatsapp_number: string | null;
      church: string | null;
      country: string | null;
    }>(
      `partners?select=full_name,whatsapp_number,church,country&whatsapp_number=in.(${list})&limit=1000`,
    );
    rows.push(...matches);
  }

  const map = new Map<
    string,
    { branch: string; name: string; country: string }
  >();
  for (const r of rows) {
    const phone = normalizePhone(r.whatsapp_number);
    if (!phone || map.has(phone)) continue; // first match wins; shared numbers exist
    map.set(phone, {
      branch: branchLabel(r.church),
      name: (r.full_name ?? "").trim(),
      country: (r.country ?? "").trim(),
    });
  }
  return map;
}

export async function loadGivingLedger(
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<GivingEntry[]> {
  const payments = await fetcher<DbGivingPayment>(
    "payments?select=reference,payer_name,payer_phone_e164,amount_minor,currency,paid_at&status=eq.Successful&order=paid_at.desc&limit=5000",
  );
  const branchByPhone = await loadPartnersForGivingPhones(
    payments.map((payment) => payment.payer_phone_e164 ?? "").filter(Boolean),
    fetcher,
  );
  return toEntries(payments, branchByPhone);
}

/** Branches present in the ledger, for the filter dropdown (always includes UNATTRIBUTED if used). */
export function branchOptions(entries: GivingEntry[]): string[] {
  const set = new Set(entries.map((e) => e.branch));
  return [...set].sort((a, b) => {
    if (a === UNATTRIBUTED) return 1;
    if (b === UNATTRIBUTED) return -1;
    return a.localeCompare(b);
  });
}
