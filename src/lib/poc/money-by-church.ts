/**
 * Money-by-Church aggregation — groups payments by church and rolls up to
 * hub, country, and region. Pure in-memory aggregation; no I/O.
 *
 * Reuses `toPaymentMethodGroup` (and the `PaymentMethodGroup` type) from the
 * existing dashboard-metrics module so the method breakdown stays consistent
 * with the rest of the POC.
 *
 * Spec: docs/superpowers/specs/2026-10-07-money-aggregation-design.md
 */

import {
  PaymentMethodGroup,
  toPaymentMethodGroup,
} from "./dashboard-metrics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChurchAggregation = {
  churchId: string;
  churchName: string;
  hubId: string;
  hubLabel: string;
  regionCode: string;
  regionName: string;
  country: string;
  totalMinor: number;
  byMethod: Record<PaymentMethodGroup, number>;
  paymentCount: number;
};

export type HubRollup = {
  hubId: string;
  hubLabel: string;
  regionCode: string;
  totalMinor: number;
  byMethod: Record<PaymentMethodGroup, number>;
  churchCount: number;
};

export type CountryRollup = {
  country: string;
  totalMinor: number;
  byMethod: Record<PaymentMethodGroup, number>;
  churchCount: number;
};

export type RegionRollup = {
  regionCode: string;
  regionName: string;
  totalMinor: number;
  byMethod: Record<PaymentMethodGroup, number>;
  churchCount: number;
};

export type MoneyByChurchResult = {
  churches: ChurchAggregation[];
  rollups: {
    byHub: HubRollup[];
    byCountry: CountryRollup[];
    byRegion: RegionRollup[];
  };
  unattributed: {
    totalMinor: number;
    paymentCount: number;
    byMethod: Record<PaymentMethodGroup, number>;
  };
};
export type PaymentForAggregation = {
  amount_minor: number;
  payment_method: string | null;
  raw_row: { matched_partner_id?: string; _payment_method?: string; source?: string } | null;
  paid_at: string;
};

export type PartnerForAggregation = {
  id: string;
  hub_id: string | null;
  church_id: string | null;
  country: string | null;
};

export type ChurchMeta = { id: string; name: string; hub_id: string };
export type HubMeta = { id: string; name: string; hub_number: number | null; region_id: string };
export type RegionMeta = { id: string; code: string; name: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UNASSIGNED_CHURCH_ID_PREFIX = "unassigned:";

function emptyMethodMap(): Record<PaymentMethodGroup, number> {
  return { mobile_money: 0, bank: 0, paystack: 0, other: 0 };
}

function addMethod(
  into: Record<PaymentMethodGroup, number>,
  group: PaymentMethodGroup,
  amount: number,
): void {
  into[group] += amount;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export function aggregateMoneyByChurch(
  payments: PaymentForAggregation[],
  partners: PartnerForAggregation[],
  churches: ChurchMeta[],
  hubs: HubMeta[],
  regions: RegionMeta[],
  monthFilter?: string,
): MoneyByChurchResult {
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const churchById = new Map(churches.map((c) => [c.id, c]));
  const hubById = new Map(hubs.map((h) => [h.id, h]));
  const regionById = new Map(regions.map((r) => [r.id, r]));

  // churchId → working aggregate
  const churchAgg = new Map<
    string,
    {
      churchName: string;
      hubId: string;
      country: string;
      totalMinor: number;
      byMethod: Record<PaymentMethodGroup, number>;
      paymentCount: number;
    }
  >();

  const unattributed = {
    totalMinor: 0,
    paymentCount: 0,
    byMethod: emptyMethodMap(),
  };

  for (const payment of payments) {
    // Month filter: only include payments whose paid_at starts with the filter.
    if (monthFilter && !payment.paid_at.startsWith(monthFilter)) continue;

    const partnerId = payment.raw_row?.matched_partner_id;
    const partner = partnerId ? partnerById.get(partnerId) : undefined;

    // No matched partner or unknown partner id → unattributed.
    if (!partner) {
      unattributed.totalMinor += payment.amount_minor;
      unattributed.paymentCount += 1;
      addMethod(
        unattributed.byMethod,
        toPaymentMethodGroup(payment.payment_method, payment.raw_row),
        payment.amount_minor,
      );
      continue;
    }

    // No hub → cannot place in a church tree → unattributed.
    if (!partner.hub_id) {
      unattributed.totalMinor += payment.amount_minor;
      unattributed.paymentCount += 1;
      addMethod(
        unattributed.byMethod,
        toPaymentMethodGroup(payment.payment_method, payment.raw_row),
        payment.amount_minor,
      );
      continue;
    }

    const hub = hubById.get(partner.hub_id);
    // Partner references a hub we don't have metadata for → unattributed.
    if (!hub) {
      unattributed.totalMinor += payment.amount_minor;
      unattributed.paymentCount += 1;
      addMethod(
        unattributed.byMethod,
        toPaymentMethodGroup(payment.payment_method, payment.raw_row),
        payment.amount_minor,
      );
      continue;
    }

    // Resolve a church key. Partners without church_id → "unassigned" within hub.
    let churchId: string;
    let churchName: string;
    if (partner.church_id) {
      const church = churchById.get(partner.church_id);
      if (!church) {
        // Church metadata missing → treat as unassigned within the hub.
        churchId = `${UNASSIGNED_CHURCH_ID_PREFIX}${partner.hub_id}`;
        churchName = "Unassigned";
      } else {
        churchId = church.id;
        churchName = church.name;
      }
    } else {
      churchId = `${UNASSIGNED_CHURCH_ID_PREFIX}${partner.hub_id}`;
      churchName = "Unassigned";
    }

    const country = partner.country ?? "Unknown";

    let agg = churchAgg.get(churchId);
    if (!agg) {
      agg = {
        churchName,
        hubId: partner.hub_id,
        country,
        totalMinor: 0,
        byMethod: emptyMethodMap(),
        paymentCount: 0,
      };
      churchAgg.set(churchId, agg);
    }

    agg.totalMinor += payment.amount_minor;
    agg.paymentCount += 1;
    addMethod(
      agg.byMethod,
      toPaymentMethodGroup(payment.payment_method, payment.raw_row),
      payment.amount_minor,
    );
  }

  // Build the church list (sorted by totalMinor desc).
  const churchList: ChurchAggregation[] = [...churchAgg.entries()]
    .map(([churchId, agg]) => {
      const hub = hubById.get(agg.hubId)!;
      const region = regionById.get(hub.region_id);
      return {
        churchId,
        churchName: agg.churchName,
        hubId: agg.hubId,
        hubLabel: hub.name,
        regionCode: region?.code ?? "Unknown",
        regionName: region?.name ?? "Unknown",
        country: agg.country,
        totalMinor: agg.totalMinor,
        byMethod: agg.byMethod,
        paymentCount: agg.paymentCount,
      };
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);

  // --- Hub rollup -----------------------------------------------------------
  const hubAgg = new Map<
    string,
    {
      hubId: string;
      regionCode: string;
      totalMinor: number;
      byMethod: Record<PaymentMethodGroup, number>;
      churchCount: number;
    }
  >();
  for (const church of churchList) {
    let agg = hubAgg.get(church.hubId);
    if (!agg) {
      const hub = hubById.get(church.hubId);
      const region = hub ? regionById.get(hub.region_id) : undefined;
      agg = {
        hubId: church.hubId,
        regionCode: region?.code ?? "Unknown",
        totalMinor: 0,
        byMethod: emptyMethodMap(),
        churchCount: 0,
      };
      hubAgg.set(church.hubId, agg);
    }
    agg.totalMinor += church.totalMinor;
    agg.churchCount += 1;
    for (const g of ["mobile_money", "bank", "paystack", "other"] as PaymentMethodGroup[]) {
      agg.byMethod[g] += church.byMethod[g];
    }
  }
  const byHub: HubRollup[] = [...hubAgg.values()]
    .map((agg) => {
      const hub = hubById.get(agg.hubId);
      return {
        hubId: agg.hubId,
        hubLabel: hub ? hub.name : agg.hubId,
        regionCode: agg.regionCode,
        totalMinor: agg.totalMinor,
        byMethod: agg.byMethod,
        churchCount: agg.churchCount,
      };
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);

  // --- Country rollup -------------------------------------------------------
  const countryAgg = new Map<
    string,
    {
      totalMinor: number;
      byMethod: Record<PaymentMethodGroup, number>;
      churchCount: number;
    }
  >();
  for (const church of churchList) {
    let agg = countryAgg.get(church.country);
    if (!agg) {
      agg = { totalMinor: 0, byMethod: emptyMethodMap(), churchCount: 0 };
      countryAgg.set(church.country, agg);
    }
    agg.totalMinor += church.totalMinor;
    agg.churchCount += 1;
    for (const g of ["mobile_money", "bank", "paystack", "other"] as PaymentMethodGroup[]) {
      agg.byMethod[g] += church.byMethod[g];
    }
  }
  const byCountry: CountryRollup[] = [...countryAgg.entries()]
    .map(([country, agg]) => ({
      country,
      totalMinor: agg.totalMinor,
      byMethod: agg.byMethod,
      churchCount: agg.churchCount,
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor);

  // --- Region rollup --------------------------------------------------------
  const regionAgg = new Map<
    string,
    {
      regionCode: string;
      regionName: string;
      totalMinor: number;
      byMethod: Record<PaymentMethodGroup, number>;
      churchCount: number;
    }
  >();
  for (const church of churchList) {
    let agg = regionAgg.get(church.regionCode);
    if (!agg) {
      agg = {
        regionCode: church.regionCode,
        regionName: church.regionName,
        totalMinor: 0,
        byMethod: emptyMethodMap(),
        churchCount: 0,
      };
      regionAgg.set(church.regionCode, agg);
    }
    agg.totalMinor += church.totalMinor;
    agg.churchCount += 1;
    for (const g of ["mobile_money", "bank", "paystack", "other"] as PaymentMethodGroup[]) {
      agg.byMethod[g] += church.byMethod[g];
    }
  }
  const byRegion: RegionRollup[] = [...regionAgg.values()]
    .map((agg) => ({
      regionCode: agg.regionCode,
      regionName: agg.regionName,
      totalMinor: agg.totalMinor,
      byMethod: agg.byMethod,
      churchCount: agg.churchCount,
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor);

  return {
    churches: churchList,
    rollups: { byHub, byCountry, byRegion },
    unattributed,
  };
}