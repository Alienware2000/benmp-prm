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
import {
  fetchAllRows,
  groupBranches,
  isSensibleName,
  isValidBranch,
  normalizeBranchKey,
  resolveBranchKey,
} from "./directory";

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
  /** Exact branch, including UNATTRIBUTED. */
  branch?: string;
};

export function toEntries(
  payments: DbGivingPayment[],
  branchByPhone: Map<string, { branch: string; name: string }>,
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
      attributed: match !== undefined,
      isStatement: isStatementRow(p.payer_name),
    };
  });
}

/**
 * Apply the UI filters. Every filter is optional and they compose with AND, which is what
 * "filter the ledger down and show me the total" means to a finance user.
 */
export function filterGiving(entries: GivingEntry[], f: GivingFilters): GivingEntry[] {
  const name = (f.name ?? "").trim().toLowerCase();
  const branch = (f.branch ?? "").trim();
  const from = (f.from ?? "").trim();
  const to = (f.to ?? "").trim();

  return entries.filter((e) => {
    // A row with no date can't satisfy a date bound; excluding it keeps the total honest.
    if (from && (!e.paidOn || e.paidOn < from)) return false;
    if (to && (!e.paidOn || e.paidOn > to)) return false;
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
  return [...entries].sort((a, b) => (a.paidAt > b.paidAt ? -1 : a.paidAt < b.paidAt ? 1 : 0));
}

/**
 * Phone -> {branch, name} for every partner with a phone. Built once per page load and
 * reused for the whole ledger.
 */
export async function loadBranchByPhone(
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<Map<string, { branch: string; name: string }>> {
  // Must page: PostgREST caps at 1000 rows, and the branch map needs all 15k partners —
  // a truncated map silently reports real giving as unattributed.
  const rows = await fetchAllRows<{
    full_name: string | null;
    whatsapp_number: string | null;
    church: string | null;
  }>(fetcher, "partners?select=full_name,whatsapp_number,church,id&whatsapp_number=not.is.null");

  // One branch spelled several ways would otherwise report as several branches, splitting
  // its giving subtotal. Resolve every spelling to the canonical label first.
  const labelByKey = new Map(groupBranches(rows.map((r) => r.church)).map((g) => [g.key, g.label]));

  const map = new Map<string, { branch: string; name: string }>();
  for (const r of rows) {
    const phone = normalizePhone(r.whatsapp_number);
    if (!phone || map.has(phone)) continue; // first match wins; shared numbers exist
    map.set(phone, {
      // A partner whose branch is unusable is still a matched partner — their giving is
      // just not attributable to a branch.
      branch: isValidBranch(r.church)
        ? (labelByKey.get(resolveBranchKey(normalizeBranchKey(r.church))) ?? (r.church ?? "").trim())
        : UNATTRIBUTED,
      name: (r.full_name ?? "").trim(),
    });
  }
  return map;
}

export async function loadGivingLedger(fetcher: Fetcher = supabaseRestFetcher()): Promise<GivingEntry[]> {
  const [payments, branchByPhone] = await Promise.all([
    fetcher<DbGivingPayment>(
      "payments?select=reference,payer_name,payer_phone_e164,amount_minor,currency,paid_at&status=eq.Successful&order=paid_at.desc&limit=5000",
    ),
    loadBranchByPhone(fetcher),
  ]);
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
