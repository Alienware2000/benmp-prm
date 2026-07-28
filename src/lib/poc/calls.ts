/**
 * Call list — who's worth a personal call, derived from the giving ledger.
 *
 * Two independent criteria, combined with OR (a person needs to satisfy only one):
 *  - "Consistent": CONSISTENT_MIN_GIFTS or more distinct gifts.
 *  - "Top giver": among the DEFAULT_TOP_GIVERS highest total givers overall.
 *
 * Built entirely from `GivingEntry[]` (the same ledger the giving page already loads,
 * cached — see loadBranchByPhoneCached), so this needs no extra Supabase round trip.
 * Bank/interop statement rows (Decision 0008 §6) are excluded — there's no one to call.
 * A giver with no partner record still has a phone (from the payment) and can be called;
 * branch/country just read as unassigned.
 */

import type { GivingEntry } from "./giving";
import { UNATTRIBUTED } from "./giving";

export const CONSISTENT_MIN_GIFTS = 2;
export const DEFAULT_TOP_GIVERS = 20;

export type CallReason = "consistent" | "top";

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
  /** How many "top givers" count, before the two criteria are combined. */
  topCount?: number;
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

/** Every giver who satisfies at least one criterion, tagged with which one(s) — the full candidate pool before filtering. */
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
    if (reasons.length === 0) continue;
    candidates.push({ phone, ...v, reasons });
  }
  return candidates.sort((a, b) => b.totalMinor - a.totalMinor);
}

/** Apply the tab's two checkboxes. Unchecking both criteria means no one qualifies — an explicit empty result, not "show everyone". */
export function filterCallCandidates(
  candidates: CallCandidate[],
  filters: CallFilters,
): CallCandidate[] {
  const wantConsistent = filters.consistent ?? true;
  const wantTop = filters.top ?? true;
  return candidates.filter(
    (c) =>
      (wantConsistent && c.reasons.includes("consistent")) ||
      (wantTop && c.reasons.includes("top")),
  );
}
