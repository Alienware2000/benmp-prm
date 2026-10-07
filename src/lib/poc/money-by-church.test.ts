import { describe, expect, it } from "vitest";

import {
  aggregateMoneyByChurch,
  type ChurchMeta,
  type HubMeta,
  type PaymentForAggregation,
  type PartnerForAggregation,
  type RegionMeta,
} from "./money-by-church";

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
];

const partners: PartnerForAggregation[] = [
  { id: "p1", hub_id: "hub-1", church_id: "church-1", country: "Ghana" },
  { id: "p2", hub_id: "hub-1", church_id: "church-2", country: "Ghana" },
  { id: "p3", hub_id: "hub-2", church_id: "church-3", country: "Ghana" },
  // Partner with a hub but no church → "unassigned" within hub.
  { id: "p4", hub_id: "hub-1", church_id: null, country: "Ghana" },
  // Partner with no hub and no church → payments go unattributed.
  { id: "p5", hub_id: null, church_id: null, country: "Nigeria" },
];

function pay(
  amount_minor: number,
  payment_method: string | null,
  matched_partner_id: string,
  paid_at = "2026-09-15T10:00:00Z",
): PaymentForAggregation {
  return {
    amount_minor,
    payment_method,
    raw_row: { matched_partner_id, _payment_method: payment_method ?? undefined },
    paid_at,
  };
}

describe("aggregateMoneyByChurch — church level", () => {
  it("aggregates payments to church level with correct method breakdowns", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1"),
      pay(2000, "mtn_mobile_money", "p1"),
      pay(5000, "bank_transfer", "p1"),
      pay(1500, "paystack_card", "p2"),
      pay(3000, "cash", "p3"),
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    const lighthouse = result.churches.find((c) => c.churchId === "church-1")!;
    expect(lighthouse).toBeDefined();
    expect(lighthouse.churchName).toBe("Lighthouse Accra");
    expect(lighthouse.hubId).toBe("hub-1");
    expect(lighthouse.hubLabel).toBe("Accra Hub");
    expect(lighthouse.regionCode).toBe("GH");
    expect(lighthouse.regionName).toBe("Ghana");
    expect(lighthouse.country).toBe("Ghana");
    expect(lighthouse.totalMinor).toBe(8000);
    expect(lighthouse.paymentCount).toBe(3);
    expect(lighthouse.byMethod.mobile_money).toBe(3000);
    expect(lighthouse.byMethod.bank).toBe(5000);
    expect(lighthouse.byMethod.paystack).toBe(0);
    expect(lighthouse.byMethod.other).toBe(0);

    const calvary = result.churches.find((c) => c.churchId === "church-2")!;
    expect(calvary.totalMinor).toBe(1500);
    expect(calvary.byMethod.paystack).toBe(1500);
  });

  it("sums multiple payment methods in one church correctly", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1"),
      pay(2000, "hubtel_mobile_money", "p1"),
      pay(4000, "bank_transfer", "p1"),
      pay(7000, "paystack_bank_transfer", "p1"),
      pay(9000, "cash", "p1"),
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    const church = result.churches.find((c) => c.churchId === "church-1")!;
    expect(church.totalMinor).toBe(23000);
    expect(church.paymentCount).toBe(5);
    expect(church.byMethod.mobile_money).toBe(3000); // 1000 + 2000
    expect(church.byMethod.bank).toBe(4000);
    expect(church.byMethod.paystack).toBe(7000);
    expect(church.byMethod.other).toBe(9000); // cash → other
  });

  it("sorts churches by totalMinor descending", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1"),
      pay(9000, "bank_transfer", "p2"),
      pay(5000, "cash", "p3"),
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    expect(result.churches.map((c) => c.totalMinor)).toEqual([9000, 5000, 1000]);
  });
});

describe("aggregateMoneyByChurch — hub rollup", () => {
  it("rolls up to hub as the sum of its churches", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1"), // church-1, hub-1
      pay(2000, "bank_transfer", "p2"), // church-2, hub-1
      pay(5000, "cash", "p3"), // church-3, hub-2
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    const hub1 = result.rollups.byHub.find((h) => h.hubId === "hub-1")!;
    expect(hub1).toBeDefined();
    expect(hub1.hubLabel).toBe("Accra Hub");
    expect(hub1.regionCode).toBe("GH");
    expect(hub1.totalMinor).toBe(3000);
    expect(hub1.churchCount).toBe(2);
    expect(hub1.byMethod.mobile_money).toBe(1000);
    expect(hub1.byMethod.bank).toBe(2000);

    const hub2 = result.rollups.byHub.find((h) => h.hubId === "hub-2")!;
    expect(hub2.totalMinor).toBe(5000);
    expect(hub2.churchCount).toBe(1);
    expect(hub2.byMethod.other).toBe(5000);
  });

  it("sorts hub rollups by totalMinor descending", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p3"), // hub-2
      pay(9000, "bank_transfer", "p1"), // hub-1
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);
    expect(result.rollups.byHub.map((h) => h.totalMinor)).toEqual([9000, 1000]);
  });
});

describe("aggregateMoneyByChurch — country rollup", () => {
  it("rolls up to country from partner country", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1"), // Ghana
      pay(2000, "bank_transfer", "p2"), // Ghana
      pay(5000, "cash", "p3"), // Ghana
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    expect(result.rollups.byCountry).toHaveLength(1);
    const ghana = result.rollups.byCountry[0];
    expect(ghana.country).toBe("Ghana");
    expect(ghana.totalMinor).toBe(8000);
    expect(ghana.churchCount).toBe(3);
    expect(ghana.byMethod.mobile_money).toBe(1000);
    expect(ghana.byMethod.bank).toBe(2000);
    expect(ghana.byMethod.other).toBe(5000);
  });

  it("sorts country rollups by totalMinor descending", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1"), // Ghana
      pay(9000, "bank_transfer", "p3"), // Ghana (only Ghana here; one entry)
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);
    expect(result.rollups.byCountry.map((c) => c.totalMinor)).toEqual([10000]);
  });
});

describe("aggregateMoneyByChurch — region rollup", () => {
  it("rolls up to region via hub.region_id", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1"), // hub-1 → reg-gh
      pay(2000, "bank_transfer", "p2"), // hub-1 → reg-gh
      pay(5000, "cash", "p3"), // hub-2 → reg-gh
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    expect(result.rollups.byRegion).toHaveLength(1);
    const gh = result.rollups.byRegion[0];
    expect(gh.regionCode).toBe("GH");
    expect(gh.regionName).toBe("Ghana");
    expect(gh.totalMinor).toBe(8000);
    expect(gh.churchCount).toBe(3);
    expect(gh.byMethod.mobile_money).toBe(1000);
  });

  it("sorts region rollups by totalMinor descending", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1"), // GH
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);
    expect(result.rollups.byRegion.map((r) => r.totalMinor)).toEqual([1000]);
  });
});

describe("aggregateMoneyByChurch — unattributed & unassigned", () => {
  it("routes payments without matched_partner_id to unattributed", () => {
    const payments: PaymentForAggregation[] = [
      {
        amount_minor: 7000,
        payment_method: "mtn_mobile_money",
        raw_row: { _payment_method: "mtn_mobile_money" },
        paid_at: "2026-09-15T10:00:00Z",
      },
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    expect(result.churches).toHaveLength(0);
    expect(result.unattributed.totalMinor).toBe(7000);
    expect(result.unattributed.paymentCount).toBe(1);
    expect(result.unattributed.byMethod.mobile_money).toBe(7000);
  });

  it("routes a matched_partner_id that has no partner to unattributed", () => {
    const payments = [
      pay(4000, "bank_transfer", "ghost-partner"),
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    expect(result.churches).toHaveLength(0);
    expect(result.unattributed.totalMinor).toBe(4000);
    expect(result.unattributed.paymentCount).toBe(1);
  });

  it("groups partners without church_id under an 'unassigned' church within their hub", () => {
    // p4 → hub-1, no church_id.
    const payments = [
      pay(3000, "mtn_mobile_money", "p4"),
      pay(2000, "cash", "p4"),
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    const unassigned = result.churches.find((c) => c.churchId === "unassigned:hub-1");
    expect(unassigned).toBeDefined();
    expect(unassigned!.churchName).toBe("Unassigned");
    expect(unassigned!.hubId).toBe("hub-1");
    expect(unassigned!.totalMinor).toBe(5000);
    expect(unassigned!.paymentCount).toBe(2);
    expect(unassigned!.byMethod.mobile_money).toBe(3000);
    expect(unassigned!.byMethod.other).toBe(2000);

    // The unassigned church should roll up into hub-1.
    const hub1 = result.rollups.byHub.find((h) => h.hubId === "hub-1")!;
    expect(hub1.totalMinor).toBe(5000);
    expect(hub1.churchCount).toBe(1);
  });

  it("routes partners with no hub to unattributed", () => {
    // p5 → no hub, no church.
    const payments = [
      pay(6000, "mtn_mobile_money", "p5"),
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    expect(result.churches).toHaveLength(0);
    expect(result.unattributed.totalMinor).toBe(6000);
    expect(result.unattributed.paymentCount).toBe(1);
  });
});

describe("aggregateMoneyByChurch — month filter", () => {
  it("only includes payments whose paid_at starts with the month filter", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1", "2026-09-15T10:00:00Z"),
      pay(2000, "bank_transfer", "p1", "2026-09-20T10:00:00Z"),
      pay(5000, "cash", "p1", "2026-08-15T10:00:00Z"),
      pay(3000, "mtn_mobile_money", "p1", "2026-10-01T10:00:00Z"),
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions, "2026-09");

    const church = result.churches.find((c) => c.churchId === "church-1")!;
    expect(church.totalMinor).toBe(3000); // 1000 + 2000
    expect(church.paymentCount).toBe(2);
    expect(church.byMethod.mobile_money).toBe(1000);
    expect(church.byMethod.bank).toBe(2000);
  });

  it("includes all payments when no month filter is given", () => {
    const payments = [
      pay(1000, "mtn_mobile_money", "p1", "2026-09-15T10:00:00Z"),
      pay(5000, "cash", "p1", "2026-08-15T10:00:00Z"),
    ];

    const result = aggregateMoneyByChurch(payments, partners, churches, hubs, regions);

    const church = result.churches.find((c) => c.churchId === "church-1")!;
    expect(church.totalMinor).toBe(6000);
    expect(church.paymentCount).toBe(2);
  });
});

describe("aggregateMoneyByChurch — empty input", () => {
  it("returns an empty result with zero totals for empty payments", () => {
    const result = aggregateMoneyByChurch([], partners, churches, hubs, regions);

    expect(result.churches).toEqual([]);
    expect(result.rollups.byHub).toEqual([]);
    expect(result.rollups.byCountry).toEqual([]);
    expect(result.rollups.byRegion).toEqual([]);
    expect(result.unattributed.totalMinor).toBe(0);
    expect(result.unattributed.paymentCount).toBe(0);
    expect(result.unattributed.byMethod).toEqual({
      mobile_money: 0,
      bank: 0,
      paystack: 0,
      other: 0,
    });
  });
});