import type { ReconciliationResult } from "../reconcile";
import { CONSISTENT_MIN_GIFTS, DEFAULT_TOP_GIVERS } from "./calls";

export type GiverCategory = "top" | "consistent" | "ordinary";

export type GiverInsight = {
  name: string;
  phone: string | null;
  registered: boolean;
  amountMinor: number;
  giftCount: number;
  latest: string;
  category: GiverCategory;
};

export type GiverInsightGroups = Record<GiverCategory, GiverInsight[]>;

type Candidate = Omit<GiverInsight, "category">;

function latestPayment(payments: Array<{ paidAt: string }>): string {
  return payments.reduce(
    (latest, payment) => (payment.paidAt > latest ? payment.paidAt : latest),
    "",
  );
}

function byAmountThenRecent(a: Candidate, b: Candidate): number {
  return b.amountMinor - a.amountMinor || b.latest.localeCompare(a.latest);
}

function byFrequencyThenRecent(a: GiverInsight, b: GiverInsight): number {
  return (
    b.giftCount - a.giftCount ||
    b.latest.localeCompare(a.latest) ||
    b.amountMinor - a.amountMinor
  );
}

/**
 * Build the three mutually exclusive giver views requested by the BENMP office.
 * Top takes precedence over consistency so one person never appears in two tabs.
 */
export function giverInsightGroups(
  result: ReconciliationResult,
  options: { limit?: number; topCount?: number } = {},
): GiverInsightGroups {
  const limit = options.limit ?? 20;
  const topCount = options.topCount ?? DEFAULT_TOP_GIVERS;

  const candidates: Candidate[] = [
    ...result.registeredPaid.map((giver) => ({
      name: giver.registration.fullName,
      phone: giver.registration.phone,
      registered: true,
      amountMinor: giver.totalMinor,
      giftCount: giver.payments.length,
      latest: latestPayment(giver.payments),
    })),
    ...result.paidUnregistered.map((giver) => ({
      name: giver.suggestedName ?? "Unknown",
      phone: giver.phone,
      registered: false,
      amountMinor: giver.totalMinor,
      giftCount: giver.payments.length,
      latest: latestPayment(giver.payments),
    })),
  ];

  const groups: GiverInsightGroups = {
    top: [],
    consistent: [],
    ordinary: [],
  };
  const topCandidates = new Set(
    [...candidates].sort(byAmountThenRecent).slice(0, topCount),
  );

  for (const candidate of candidates) {
    const category: GiverCategory = topCandidates.has(candidate)
      ? "top"
      : candidate.giftCount >= CONSISTENT_MIN_GIFTS
        ? "consistent"
        : "ordinary";
    groups[category].push({ ...candidate, category });
  }

  return {
    top: groups.top.sort(byAmountThenRecent).slice(0, limit),
    consistent: groups.consistent.sort(byFrequencyThenRecent).slice(0, limit),
    ordinary: groups.ordinary
      .sort((a, b) => b.latest.localeCompare(a.latest))
      .slice(0, limit),
  };
}
