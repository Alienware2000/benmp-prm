import type { ReconciliationResult } from "../reconcile";
import type { DirectoryPartner } from "./directory";
import { giverInsightGroups, type GiverInsight } from "./giver-insights";

export const AUDIENCE_KEYS = [
  "everyone",
  "paid",
  "unpaid",
  "top",
  "consistent",
  "new",
  "legacy-ghana",
] as const;

export type AudienceKey = (typeof AUDIENCE_KEYS)[number];
export type AudienceCounts = Record<AudienceKey, number>;

export function isAudienceKey(value: unknown): value is AudienceKey {
  return (
    typeof value === "string" &&
    (AUDIENCE_KEYS as readonly string[]).includes(value)
  );
}

export function audienceCounts(
  result: ReconciliationResult,
  allPartnerRecords: number,
  legacyGhanaRecords = 0,
): AudienceCounts {
  const groups = giverInsightGroups(result, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  return {
    everyone: allPartnerRecords,
    paid: result.registeredPaid.length + result.paidUnregistered.length,
    unpaid: result.registeredUnpaid.length,
    top: groups.top.length,
    consistent: groups.consistent.length,
    new: result.paidUnregistered.length,
    "legacy-ghana": legacyGhanaRecords,
  };
}

function insightPartner(
  insight: GiverInsight,
  index: number,
): DirectoryPartner {
  return {
    id: `audience:${insight.category}:${insight.phone ?? insight.name}:${index}`,
    name: insight.name,
    phone: insight.phone,
    branch: "Unassigned",
    country: "—",
    givenMinor: insight.amountMinor,
    messageable: insight.phone !== null,
  };
}

/** Resolve giver-specific cohorts from the period reconciliation. */
export function reconciliationAudiencePartners(
  result: ReconciliationResult,
  audience: Extract<AudienceKey, "top" | "consistent" | "new">,
): DirectoryPartner[] {
  if (audience === "new") {
    return result.paidUnregistered.map((giver, index) => ({
      id: `audience:new:${giver.phone ?? giver.payments[0]?.reference ?? index}`,
      name: giver.suggestedName ?? "Unknown",
      phone: giver.phone,
      branch: "Unassigned",
      country: "—",
      givenMinor: giver.totalMinor,
      messageable: giver.phone !== null,
    }));
  }

  const groups = giverInsightGroups(result, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  return groups[audience].map(insightPartner);
}

/**
 * A standing directory can contain duplicate rows for one WhatsApp number. A broadcast
 * must resolve that person once, while phoneless rows stay visible in preview counts.
 */
export function dedupeAudiencePartners(
  partners: DirectoryPartner[],
): DirectoryPartner[] {
  const seen = new Map<string, DirectoryPartner>();
  const phoneless: DirectoryPartner[] = [];

  for (const partner of partners) {
    if (!partner.phone) {
      phoneless.push(partner);
      continue;
    }
    const current = seen.get(partner.phone);
    if (!current || partner.givenMinor > current.givenMinor) {
      seen.set(partner.phone, partner);
    }
  }

  return [...seen.values(), ...phoneless];
}

export function filterAudienceByAmount(
  partners: DirectoryPartner[],
  range: { minAmountMinor?: number; maxAmountMinor?: number },
): DirectoryPartner[] {
  return partners.filter(
    (partner) =>
      (range.minAmountMinor === undefined ||
        partner.givenMinor >= range.minAmountMinor) &&
      (range.maxAmountMinor === undefined ||
        partner.givenMinor <= range.maxAmountMinor),
  );
}
