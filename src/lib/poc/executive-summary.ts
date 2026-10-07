/**
 * Executive summary aggregation for the POC overview.
 *
 * Computes total money raised, USD conversion, an "active partners" figure
 * derived from the total, and breakdowns by payment-method group and region.
 *
 * Reuses the partner-matching pattern from dashboard-metrics.ts:
 *   raw_row.matched_partner_id → partner → geography, with a fallback to Ghana
 *   via ghanaLastNineKey phone matching (and finally a hard Ghana default).
 */

import {
  toGeography,
  toPaymentMethodGroup,
  type Geography,
  type PaymentMethodGroup,
} from "./dashboard-metrics";
import { ghanaLastNineKey } from "./payment-upload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecutiveSummary = {
  totalGhsMinor: number;
  totalUsd: number;
  activePartners: number;
  fxRate: number;
  activeThresholdUsd: number;
  byMethod: Record<PaymentMethodGroup, number>;
  byRegion: {
    region: string;
    totalGhsMinor: number;
    totalUsd: number;
    activePartners: number;
  }[];
  paymentCount: number;
};

export type PaymentForSummary = {
  amount_minor: number;
  payment_method: string | null;
  raw_row: {
    matched_partner_id?: string;
    _payment_method?: string;
    source?: string;
    church_id?: string;
    hub_id?: string;
  } | null;
  paid_at: string;
  payer_phone_e164: string | null;
};

export type PartnerForSummary = {
  id: string;
  country: string | null;
  momo_phone_number: string | null;
  whatsapp_number: string | null;
};

export type { Geography, PaymentMethodGroup };

function emptyByMethod(): Record<PaymentMethodGroup, number> {
  return {
    mobile_money: 0,
    bank: 0,
    cash: 0,
    paystack: 0,
    other: 0,
  };
}

export function buildExecutiveSummary(
  payments: PaymentForSummary[],
  partners: PartnerForSummary[],
  monthFilter?: string,
  fxRate = 12,
  activeThresholdUsd = 5,
): ExecutiveSummary {
  // 1. Build partner lookup: partnerById and partnerIdByLastNine (Ghana phone matching).
  const partnerById = new Map<string, PartnerForSummary>();
  const partnerIdByLastNine = new Map<string, string>();
  for (const p of partners) {
    partnerById.set(p.id, p);
    for (const phone of [p.momo_phone_number, p.whatsapp_number]) {
      const key = ghanaLastNineKey(phone);
      if (key && !partnerIdByLastNine.has(key)) partnerIdByLastNine.set(key, p.id);
    }
  }

  // 2. Aggregate.
  let totalGhsMinor = 0;
  let paymentCount = 0;
  const byMethod = emptyByMethod();
  const regionMinor = new Map<Geography, number>();

  for (const payment of payments) {
    // Month filter: skip payments whose paid_at doesn't start with the filter.
    if (monthFilter && !(payment.paid_at ?? "").startsWith(monthFilter)) continue;

    const amount = Number(payment.amount_minor);
    totalGhsMinor += amount;
    paymentCount += 1;

    // Group by payment-method group.
    const group = toPaymentMethodGroup(payment.payment_method, payment.raw_row);
    byMethod[group] += amount;

    // Resolve partner → geography. Default to Ghana (same as dashboard-metrics.ts).
    const matchedId =
      typeof payment.raw_row?.matched_partner_id === "string"
        ? payment.raw_row.matched_partner_id
        : null;
    const lastNine = ghanaLastNineKey(payment.payer_phone_e164);
    const partnerId =
      matchedId ?? (lastNine ? partnerIdByLastNine.get(lastNine) : null) ?? null;
    const partner = partnerId ? partnerById.get(partnerId) : null;
    const geo = partner ? toGeography(partner.country) : "Ghana";

    regionMinor.set(geo, (regionMinor.get(geo) ?? 0) + amount);
  }

  // 3. Derive USD + active partners.
  const totalUsd = totalGhsMinor / 100 / fxRate;
  const activePartners = Math.floor(totalUsd / activeThresholdUsd);

  // 4. Per-region breakdown, sorted by totalGhsMinor desc.
  const byRegion = Array.from(regionMinor.entries())
    .map(([region, regionGhsMinor]) => {
      const regionUsd = regionGhsMinor / 100 / fxRate;
      return {
        region,
        totalGhsMinor: regionGhsMinor,
        totalUsd: regionUsd,
        activePartners: Math.floor(regionUsd / activeThresholdUsd),
      };
    })
    .sort((a, b) => b.totalGhsMinor - a.totalGhsMinor);

  return {
    totalGhsMinor,
    totalUsd,
    activePartners,
    fxRate,
    activeThresholdUsd,
    byMethod,
    byRegion,
    paymentCount,
  };
}