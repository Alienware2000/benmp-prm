/**
 * Call list — who's worth a personal call, derived from the giving ledger.
 *
 * Three criteria:
 *  - "Consistent": CONSISTENT_MIN_GIFTS or more distinct gifts.
 *  - "Top giver": among the DEFAULT_TOP_GIVERS highest total givers overall.
 *  - "Ordinary": reachable givers who are neither top nor consistent.
 *
 * Built entirely from `GivingEntry[]` (the same ledger the giving page already loads,
 * already attached to the ledger), so this needs no extra Supabase round trip.
 * Bank/interop statement rows (Decision 0008 §6) are excluded — there's no one to call.
 * A giver with no partner record still has a phone (from the payment) and can be called;
 * branch/country just read as unassigned.
 */

import type { GivingEntry } from "./giving";
import { UNATTRIBUTED } from "./giving";

export const CONSISTENT_MIN_GIFTS = 2;
export const DEFAULT_TOP_GIVERS = 20;
export const DEFAULT_MONTHLY_CALLS = 20;

export type CallReason = "consistent" | "top" | "ordinary";

export type CallCandidate = {
  phone: string;
  name: string;
  branch: string;
  country: string;
  giftCount: number;
  totalMinor: number;
  currency: string;
  reasons: CallReason[];
};

export type CallFilters = {
  /** Include people with CONSISTENT_MIN_GIFTS+ gifts. Default true. */
  consistent?: boolean;
  /** Include the top givers by total amount. Default true. */
  top?: boolean;
  /** Include one-time / non-top / non-consistent givers. Default true. */
  ordinary?: boolean;
  /** How many "top givers" count, before the criteria are combined. */
  topCount?: number;
};

export type MonthlyCallListOptions = {
  monthKey?: string;
  size?: number;
};

/** One row per distinct phone: gift count, total, and the most recent sensible name/branch/country seen. */
function aggregateByPhone(entries: GivingEntry[]) {
  const byPhone = new Map<
    string,
    {
      name: string;
      branch: string;
      country: string;
      currency: string;
      giftCount: number;
      totalMinor: number;
    }
  >();
  for (const e of entries) {
    if (e.isStatement || !e.phone) continue; // not a person, or unreachable — can't be called
    const existing = byPhone.get(e.phone);
    if (existing) {
      existing.giftCount += 1;
      existing.totalMinor += e.amountMinor;
      // A later row with an actual branch/country replaces an unattributed placeholder.
      if (existing.branch === UNATTRIBUTED && e.branch !== UNATTRIBUTED)
        existing.branch = e.branch;
      if (existing.country === "—" && e.country !== "—")
        existing.country = e.country;
    } else {
      byPhone.set(e.phone, {
        name: e.name,
        branch: e.branch,
        country: e.country,
        currency: e.currency,
        giftCount: 1,
        totalMinor: e.amountMinor,
      });
    }
  }
  return byPhone;
}

/** Every reachable giver, tagged with their call reasons — the full candidate pool before filtering. */
export function buildCallCandidates(
  entries: GivingEntry[],
  topCount: number = DEFAULT_TOP_GIVERS,
): CallCandidate[] {
  const byPhone = aggregateByPhone(entries);
  const topPhones = new Set(
    [...byPhone.entries()]
      .sort((a, b) => b[1].totalMinor - a[1].totalMinor)
      .slice(0, topCount)
      .map(([phone]) => phone),
  );

  const candidates: CallCandidate[] = [];
  for (const [phone, v] of byPhone) {
    const reasons: CallReason[] = [];
    if (v.giftCount >= CONSISTENT_MIN_GIFTS) reasons.push("consistent");
    if (topPhones.has(phone)) reasons.push("top");
    if (reasons.length === 0) reasons.push("ordinary");
    candidates.push({ phone, ...v, reasons });
  }
  return candidates.sort((a, b) => b.totalMinor - a.totalMinor);
}

/** Apply the tab's criteria checkboxes. Unchecking all criteria means no one qualifies. */
export function filterCallCandidates(
  candidates: CallCandidate[],
  filters: CallFilters,
): CallCandidate[] {
  const wantConsistent = filters.consistent ?? true;
  const wantTop = filters.top ?? true;
  const wantOrdinary = filters.ordinary ?? true;
  return candidates.filter(
    (c) =>
      (wantConsistent && c.reasons.includes("consistent")) ||
      (wantTop && c.reasons.includes("top")) ||
      (wantOrdinary && c.reasons.includes("ordinary")),
  );
}

/** Stable month key in UTC (e.g. "2026-08") so the shortlist changes monthly, not daily. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: T[], seedInput: string): T[] {
  let state = hashSeed(seedInput);
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function enabledReasons(filters: CallFilters): CallReason[] {
  const reasons: CallReason[] = [];
  if (filters.top ?? true) reasons.push("top");
  if (filters.consistent ?? true) reasons.push("consistent");
  if (filters.ordinary ?? true) reasons.push("ordinary");
  return reasons;
}

/**
 * Deterministic monthly shortlist.
 *
 * Mixes selected reason buckets as evenly as possible, then fills any shortfall from the
 * remaining filtered pool. Same monthKey => same order, new monthKey => reshuffled list.
 */
export function buildMonthlyCallList(
  candidates: CallCandidate[],
  filters: CallFilters,
  options: MonthlyCallListOptions = {},
): CallCandidate[] {
  const size = Math.max(0, options.size ?? DEFAULT_MONTHLY_CALLS);
  if (size === 0) return [];

  const pool = filterCallCandidates(candidates, filters);
  if (pool.length === 0) return [];

  const reasons = enabledReasons(filters);
  if (reasons.length === 0) return [];

  const key = options.monthKey ?? monthKey();
  const quotaBase = Math.floor(size / reasons.length);
  const remainder = size % reasons.length;

  const picked = new Set<string>();
  const shortlist: CallCandidate[] = [];

  for (let idx = 0; idx < reasons.length; idx += 1) {
    const reason = reasons[idx];
    const quota = quotaBase + (idx < remainder ? 1 : 0);
    const segment = seededShuffle(
      pool.filter((c) => c.reasons.includes(reason)),
      `${key}:${reason}`,
    );

    for (const candidate of segment) {
      if (shortlist.length >= size) return shortlist;
      if (picked.has(candidate.phone)) continue;
      shortlist.push(candidate);
      picked.add(candidate.phone);
      if (shortlist.length >= quota * (idx + 1)) break;
    }
  }

  if (shortlist.length >= size) return shortlist;

  const remainderPool = seededShuffle(
    pool.filter((c) => !picked.has(c.phone)),
    `${key}:fill`,
  );
  for (const candidate of remainderPool) {
    if (shortlist.length >= size) break;
    shortlist.push(candidate);
  }
  return shortlist;
}
