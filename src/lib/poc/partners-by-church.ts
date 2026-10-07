/**
 * Partners-by-Church aggregation — groups partners by church and rolls up to
 * hub, country, and region, with status breakdowns.
 *
 * Pure sibling of `money-by-church.ts`: same roll-up shape, but counts partners
 * (with a `byStatus` breakdown) instead of summing payment amounts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PartnerForCount = {
  id: string;
  hub_id: string | null;
  church_id: string | null;
  country: string | null;
  status: string | null;
};

export type ChurchMeta = { id: string; name: string; hub_id: string };
export type HubMeta = { id: string; name: string; hub_number: number | null; region_id: string };
export type RegionMeta = { id: string; code: string; name: string };

export type StatusBreakdown = Record<string, number>;

export type ChurchPartnerAggregation = {
  churchId: string;
  churchName: string;
  hubId: string;
  hubLabel: string;
  regionCode: string;
  regionName: string;
  country: string;
  partnerCount: number;
  byStatus: StatusBreakdown;
};

export type PartnerByChurchResult = {
  churches: ChurchPartnerAggregation[];
  rollups: {
    byHub: { hubId: string; hubLabel: string; regionCode: string; partnerCount: number; churchCount: number }[];
    byCountry: { country: string; partnerCount: number; churchCount: number }[];
    byRegion: { regionCode: string; regionName: string; partnerCount: number; churchCount: number }[];
  };
  unassigned: { partnerCount: number; byStatus: StatusBreakdown };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UNASSIGNED_CHURCH_ID_PREFIX = "unassigned:";

/** Known status values that the API/UI treats as first-class columns. */
const KNOWN_STATUSES = new Set([
  "active",
  "new",
  "needs_follow_up",
  "inactive",
]);

/**
 * Normalise a raw status string into a `byStatus` bucket key. The four known
 * statuses (active, new, needs_follow_up, inactive) keep their raw string as
 * the key; any other value — including `null` and unrecognised strings — is
 * grouped under "other", matching the spec's `byStatus` example where
 * `other` is the catch-all bucket.
 */
function statusKey(status: string | null): string {
  if (status === null) return "other";
  return KNOWN_STATUSES.has(status) ? status : "other";
}

function bumpStatus(into: StatusBreakdown, status: string | null): void {
  const key = statusKey(status);
  into[key] = (into[key] ?? 0) + 1;
}

export function aggregatePartnersByChurch(
  partners: PartnerForCount[],
  churches: ChurchMeta[],
  hubs: HubMeta[],
  regions: RegionMeta[],
): PartnerByChurchResult {
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
      partnerCount: number;
      byStatus: StatusBreakdown;
    }
  >();

  const unassigned: { partnerCount: number; byStatus: StatusBreakdown } = {
    partnerCount: 0,
    byStatus: {},
  };

  for (const partner of partners) {
    const partnerHubId = partner.hub_id;
    const churchId = partner.church_id;
    const country = partner.country;

    // Resolve the church first. A known church determines its own hub
    // (churches belong to exactly one hub), so the church's hub_id wins over
    // the partner's possibly-mismatched hub_id. Partners with no church, or
    // an unknown church, fall back to their own hub_id as an "unassigned"
    // church within that hub.
    let resolvedChurchId: string;
    let churchName: string;
    let hubId: string;
    if (churchId) {
      const church = churchById.get(churchId);
      if (church) {
        resolvedChurchId = church.id;
        churchName = church.name;
        hubId = church.hub_id;
      } else {
        // Unknown church_id → unassigned within the partner's hub (if any).
        resolvedChurchId = `${UNASSIGNED_CHURCH_ID_PREFIX}${partnerHubId ?? "none"}`;
        churchName = "Unassigned";
        hubId = partnerHubId ?? "";
      }
    } else {
      resolvedChurchId = `${UNASSIGNED_CHURCH_ID_PREFIX}${partnerHubId ?? "none"}`;
      churchName = "Unassigned";
      hubId = partnerHubId ?? "";
    }

    // No hub resolvable → unassigned bucket.
    if (!hubId) {
      unassigned.partnerCount += 1;
      bumpStatus(unassigned.byStatus, partner.status);
      continue;
    }

    const hub = hubById.get(hubId);
    if (!hub) {
      // Hub reference is dangling — treat as unassigned so the partner is
      // still counted rather than silently dropped.
      unassigned.partnerCount += 1;
      bumpStatus(unassigned.byStatus, partner.status);
      continue;
    }

    const resolvedCountry = country ?? "Unknown";

    let agg = churchAgg.get(resolvedChurchId);
    if (!agg) {
      agg = {
        churchName,
        hubId,
        country: resolvedCountry,
        partnerCount: 0,
        byStatus: {},
      };
      churchAgg.set(resolvedChurchId, agg);
    }

    agg.partnerCount += 1;
    bumpStatus(agg.byStatus, partner.status);
  }

  // Build the church list (sorted by partnerCount desc).
  const churchList: ChurchPartnerAggregation[] = [...churchAgg.entries()]
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
        partnerCount: agg.partnerCount,
        byStatus: agg.byStatus,
      };
    })
    .sort((a, b) => b.partnerCount - a.partnerCount);

  // --- Hub rollup -----------------------------------------------------------
  const hubAgg = new Map<
    string,
    { hubId: string; regionCode: string; partnerCount: number; churchCount: number }
  >();
  for (const church of churchList) {
    let agg = hubAgg.get(church.hubId);
    if (!agg) {
      const hub = hubById.get(church.hubId);
      const region = hub ? regionById.get(hub.region_id) : undefined;
      agg = {
        hubId: church.hubId,
        regionCode: region?.code ?? "Unknown",
        partnerCount: 0,
        churchCount: 0,
      };
      hubAgg.set(church.hubId, agg);
    }
    agg.partnerCount += church.partnerCount;
    agg.churchCount += 1;
  }
  const byHub = [...hubAgg.values()]
    .map((agg) => {
      const hub = hubById.get(agg.hubId);
      return {
        hubId: agg.hubId,
        hubLabel: hub ? hub.name : agg.hubId,
        regionCode: agg.regionCode,
        partnerCount: agg.partnerCount,
        churchCount: agg.churchCount,
      };
    })
    .sort((a, b) => b.partnerCount - a.partnerCount);

  // --- Country rollup -------------------------------------------------------
  const countryAgg = new Map<string, { partnerCount: number; churchCount: number }>();
  for (const church of churchList) {
    let agg = countryAgg.get(church.country);
    if (!agg) {
      agg = { partnerCount: 0, churchCount: 0 };
      countryAgg.set(church.country, agg);
    }
    agg.partnerCount += church.partnerCount;
    agg.churchCount += 1;
  }
  const byCountry = [...countryAgg.entries()]
    .map(([country, agg]) => ({
      country,
      partnerCount: agg.partnerCount,
      churchCount: agg.churchCount,
    }))
    .sort((a, b) => b.partnerCount - a.partnerCount);

  // --- Region rollup --------------------------------------------------------
  const regionAgg = new Map<
    string,
    { regionCode: string; regionName: string; partnerCount: number; churchCount: number }
  >();
  for (const church of churchList) {
    let agg = regionAgg.get(church.regionCode);
    if (!agg) {
      agg = {
        regionCode: church.regionCode,
        regionName: church.regionName,
        partnerCount: 0,
        churchCount: 0,
      };
      regionAgg.set(church.regionCode, agg);
    }
    agg.partnerCount += church.partnerCount;
    agg.churchCount += 1;
  }
  const byRegion = [...regionAgg.values()]
    .map((agg) => ({
      regionCode: agg.regionCode,
      regionName: agg.regionName,
      partnerCount: agg.partnerCount,
      churchCount: agg.churchCount,
    }))
    .sort((a, b) => b.partnerCount - a.partnerCount);

  return {
    churches: churchList,
    rollups: { byHub, byCountry, byRegion },
    unassigned,
  };
}