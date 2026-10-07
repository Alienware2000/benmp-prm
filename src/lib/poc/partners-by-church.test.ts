import { describe, expect, it } from "vitest";

import {
  aggregatePartnersByChurch,
  type ChurchMeta,
  type HubMeta,
  type PartnerForCount,
  type RegionMeta,
} from "./partners-by-church";

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

const regions: RegionMeta[] = [
  { id: "reg-gh", code: "GH", name: "Ghana" },
  { id: "reg-uk", code: "UK", name: "United Kingdom" },
];

const hubs: HubMeta[] = [
  { id: "hub-1", name: "Accra Hub", hub_number: 1, region_id: "reg-gh" },
  { id: "hub-2", name: "Kumasi Hub", hub_number: 2, region_id: "reg-gh" },
  { id: "hub-3", name: "London Hub", hub_number: 3, region_id: "reg-uk" },
];

const churches: ChurchMeta[] = [
  { id: "church-1", name: "Lighthouse Accra", hub_id: "hub-1" },
  { id: "church-2", name: "Calvary Accra", hub_id: "hub-1" },
  { id: "church-3", name: "Grace Kumasi", hub_id: "hub-2" },
  { id: "church-4", name: "Thames London", hub_id: "hub-3" },
];

function partner(
  id: string,
  hub_id: string | null,
  church_id: string | null,
  country: string | null,
  status: string | null,
): PartnerForCount {
  return { id, hub_id, church_id, country, status };
}

// ---------------------------------------------------------------------------
// Church level
// ---------------------------------------------------------------------------

describe("aggregatePartnersByChurch — church level", () => {
  it("aggregates partner counts by church with status breakdowns", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-1", "church-1", "Ghana", "active"),
      partner("p3", "hub-1", "church-1", "Ghana", "new"),
      partner("p4", "hub-1", "church-2", "Ghana", "needs_follow_up"),
      partner("p5", "hub-2", "church-3", "Ghana", "inactive"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    const lighthouse = result.churches.find((c) => c.churchId === "church-1")!;
    expect(lighthouse).toBeDefined();
    expect(lighthouse.churchName).toBe("Lighthouse Accra");
    expect(lighthouse.hubId).toBe("hub-1");
    expect(lighthouse.hubLabel).toBe("Accra Hub");
    expect(lighthouse.regionCode).toBe("GH");
    expect(lighthouse.regionName).toBe("Ghana");
    expect(lighthouse.country).toBe("Ghana");
    expect(lighthouse.partnerCount).toBe(3);
    expect(lighthouse.byStatus.active).toBe(2);
    expect(lighthouse.byStatus.new).toBe(1);

    const calvary = result.churches.find((c) => c.churchId === "church-2")!;
    expect(calvary.partnerCount).toBe(1);
    expect(calvary.byStatus.needs_follow_up).toBe(1);

    const grace = result.churches.find((c) => c.churchId === "church-3")!;
    expect(grace.partnerCount).toBe(1);
    expect(grace.byStatus.inactive).toBe(1);
  });

  it("counts each status correctly when multiple statuses share one church", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-1", "church-1", "Ghana", "new"),
      partner("p3", "hub-1", "church-1", "Ghana", "needs_follow_up"),
      partner("p4", "hub-1", "church-1", "Ghana", "inactive"),
      partner("p5", "hub-1", "church-1", "Ghana", "active"),
      partner("p6", "hub-1", "church-1", "Ghana", "something_else"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    const church = result.churches.find((c) => c.churchId === "church-1")!;
    expect(church.partnerCount).toBe(6);
    expect(church.byStatus.active).toBe(2);
    expect(church.byStatus.new).toBe(1);
    expect(church.byStatus.needs_follow_up).toBe(1);
    expect(church.byStatus.inactive).toBe(1);
    expect(church.byStatus.other).toBe(1);
  });

  it("sorts churches by partnerCount descending", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-2", "church-3", "Ghana", "active"),
      partner("p3", "hub-2", "church-3", "Ghana", "active"),
      partner("p4", "hub-2", "church-3", "Ghana", "active"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    expect(result.churches.map((c) => c.partnerCount)).toEqual([3, 1]);
    expect(result.churches[0].churchId).toBe("church-3");
    expect(result.churches[1].churchId).toBe("church-1");
  });

  it("groups unknown statuses under 'other'", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-1", "church-1", "Ghana", "mystery"),
      partner("p3", "hub-1", "church-1", "Ghana", "mystery"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    const church = result.churches.find((c) => c.churchId === "church-1")!;
    expect(church.byStatus.active).toBe(1);
    expect(church.byStatus.other).toBe(2);
    expect(church.byStatus.mystery).toBeUndefined();
    expect(church.partnerCount).toBe(3);
  });

  it("treats null status as 'other'", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", null),
      partner("p2", "hub-1", "church-1", "Ghana", null),
      partner("p3", "hub-1", "church-1", "Ghana", "active"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    const church = result.churches.find((c) => c.churchId === "church-1")!;
    expect(church.byStatus.other).toBe(2);
    expect(church.byStatus.active).toBe(1);
    expect(church.partnerCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Hub rollup
// ---------------------------------------------------------------------------

describe("aggregatePartnersByChurch — hub rollup", () => {
  it("rolls up to hub as the sum of partners in its churches", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-1", "church-2", "Ghana", "active"),
      partner("p3", "hub-2", "church-3", "Ghana", "active"),
      partner("p4", "hub-2", "church-3", "Ghana", "new"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    const hub1 = result.rollups.byHub.find((h) => h.hubId === "hub-1")!;
    expect(hub1).toBeDefined();
    expect(hub1.hubLabel).toBe("Accra Hub");
    expect(hub1.regionCode).toBe("GH");
    expect(hub1.partnerCount).toBe(2);
    expect(hub1.churchCount).toBe(2);

    const hub2 = result.rollups.byHub.find((h) => h.hubId === "hub-2")!;
    expect(hub2.partnerCount).toBe(2);
    expect(hub2.churchCount).toBe(1);
  });

  it("sorts hub rollups by partnerCount descending", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-2", "church-3", "Ghana", "active"),
      partner("p3", "hub-2", "church-3", "Ghana", "active"),
      partner("p4", "hub-2", "church-3", "Ghana", "active"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    expect(result.rollups.byHub.map((h) => h.partnerCount)).toEqual([3, 1]);
    expect(result.rollups.byHub[0].hubId).toBe("hub-2");
  });
});

// ---------------------------------------------------------------------------
// Country rollup
// ---------------------------------------------------------------------------

describe("aggregatePartnersByChurch — country rollup", () => {
  it("rolls up to country from partner country", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-1", "church-2", "Ghana", "active"),
      partner("p3", "hub-2", "church-3", "Ghana", "active"),
      partner("p4", "hub-3", "church-4", "United Kingdom", "active"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    const ghana = result.rollups.byCountry.find((c) => c.country === "Ghana")!;
    expect(ghana).toBeDefined();
    expect(ghana.partnerCount).toBe(3);
    expect(ghana.churchCount).toBe(3);

    const uk = result.rollups.byCountry.find((c) => c.country === "United Kingdom")!;
    expect(uk.partnerCount).toBe(1);
    expect(uk.churchCount).toBe(1);
  });

  it("sorts country rollups by partnerCount descending", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-3", "church-4", "United Kingdom", "active"),
      partner("p3", "hub-3", "church-4", "United Kingdom", "active"),
      partner("p4", "hub-3", "church-4", "United Kingdom", "active"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    expect(result.rollups.byCountry.map((c) => c.partnerCount)).toEqual([3, 1]);
    expect(result.rollups.byCountry[0].country).toBe("United Kingdom");
  });
});

// ---------------------------------------------------------------------------
// Region rollup
// ---------------------------------------------------------------------------

describe("aggregatePartnersByChurch — region rollup", () => {
  it("rolls up to region via hub.region_id", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-2", "church-3", "Ghana", "active"),
      partner("p3", "hub-3", "church-4", "United Kingdom", "active"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    const gh = result.rollups.byRegion.find((r) => r.regionCode === "GH")!;
    expect(gh).toBeDefined();
    expect(gh.regionName).toBe("Ghana");
    expect(gh.partnerCount).toBe(2);
    expect(gh.churchCount).toBe(2);

    const uk = result.rollups.byRegion.find((r) => r.regionCode === "UK")!;
    expect(uk.partnerCount).toBe(1);
    expect(uk.churchCount).toBe(1);
  });

  it("sorts region rollups by partnerCount descending", () => {
    const partners: PartnerForCount[] = [
      partner("p1", "hub-1", "church-1", "Ghana", "active"),
      partner("p2", "hub-3", "church-4", "United Kingdom", "active"),
      partner("p3", "hub-3", "church-4", "United Kingdom", "active"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    expect(result.rollups.byRegion.map((r) => r.partnerCount)).toEqual([2, 1]);
    expect(result.rollups.byRegion[0].regionCode).toBe("UK");
  });
});

// ---------------------------------------------------------------------------
// Unassigned & unattributed
// ---------------------------------------------------------------------------

describe("aggregatePartnersByChurch — unassigned & unattributed", () => {
  it("groups partners without church_id under an 'unassigned' church within their hub", () => {
    const partners: PartnerForCount[] = [
      partner("p4", "hub-1", null, "Ghana", "active"),
      partner("p4b", "hub-1", null, "Ghana", "new"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    const unassigned = result.churches.find((c) => c.churchId === "unassigned:hub-1");
    expect(unassigned).toBeDefined();
    expect(unassigned!.churchName).toBe("Unassigned");
    expect(unassigned!.hubId).toBe("hub-1");
    expect(unassigned!.partnerCount).toBe(2);
    expect(unassigned!.byStatus.active).toBe(1);
    expect(unassigned!.byStatus.new).toBe(1);

    // The unassigned church should roll up into hub-1.
    const hub1 = result.rollups.byHub.find((h) => h.hubId === "hub-1")!;
    expect(hub1.partnerCount).toBe(2);
    expect(hub1.churchCount).toBe(1);
  });

  it("routes partners without hub_id to the unassigned bucket", () => {
    const partners: PartnerForCount[] = [
      partner("p5", null, null, "Nigeria", "active"),
      partner("p5b", null, null, "Nigeria", "inactive"),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    expect(result.churches).toHaveLength(0);
    expect(result.unassigned.partnerCount).toBe(2);
    expect(result.unassigned.byStatus.active).toBe(1);
    expect(result.unassigned.byStatus.inactive).toBe(1);
  });

  it("treats null status in the unassigned bucket as 'other'", () => {
    const partners: PartnerForCount[] = [
      partner("p5", null, null, "Nigeria", null),
    ];

    const result = aggregatePartnersByChurch(partners, churches, hubs, regions);

    expect(result.unassigned.partnerCount).toBe(1);
    expect(result.unassigned.byStatus.other).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe("aggregatePartnersByChurch — empty input", () => {
  it("returns an empty result with zero totals for empty partners", () => {
    const result = aggregatePartnersByChurch([], churches, hubs, regions);

    expect(result.churches).toEqual([]);
    expect(result.rollups.byHub).toEqual([]);
    expect(result.rollups.byCountry).toEqual([]);
    expect(result.rollups.byRegion).toEqual([]);
    expect(result.unassigned.partnerCount).toBe(0);
    expect(result.unassigned.byStatus).toEqual({});
  });
});