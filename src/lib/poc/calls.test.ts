import { describe, expect, it } from "vitest";
import {
  buildCallCandidates,
  filterCallCandidates,
  type CallCandidate,
} from "./calls";
import { UNATTRIBUTED, type GivingEntry } from "./giving";

function entry(overrides: Partial<GivingEntry>): GivingEntry {
  return {
    reference: "r",
    name: "Someone",
    phone: "+233240000001",
    amountMinor: 1_000,
    currency: "GHS",
    paidAt: "2026-06-01T00:00:00+00:00",
    paidOn: "2026-06-01",
    branch: "Qodesh",
    country: "Ghana",
    attributed: true,
    isStatement: false,
    ...overrides,
  };
}

describe("buildCallCandidates", () => {
  it("tags 2+ gifts as consistent", () => {
    const entries = [
      entry({ reference: "a", phone: "+233240000001" }),
      entry({ reference: "b", phone: "+233240000001" }),
    ];
    const [c] = buildCallCandidates(entries, 0); // topCount 0 so nothing qualifies via "top"
    expect(c.reasons).toEqual(["consistent"]);
    expect(c.giftCount).toBe(2);
    expect(c.totalMinor).toBe(2_000);
  });

  it("tags the highest total givers as top even with a single gift", () => {
    const entries = [
      entry({ reference: "a", phone: "+233240000001", amountMinor: 50_000 }),
      entry({ reference: "b", phone: "+233240000002", amountMinor: 10 }),
    ];
    const candidates = buildCallCandidates(entries, 1);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].phone).toBe("+233240000001");
    expect(candidates[0].reasons).toEqual(["top"]);
  });

  it("tags both when a person is consistent and a top giver", () => {
    const entries = [
      entry({ reference: "a", phone: "+233240000001", amountMinor: 50_000 }),
      entry({ reference: "b", phone: "+233240000001", amountMinor: 50_000 }),
    ];
    const [c] = buildCallCandidates(entries, 1);
    expect(c.reasons).toEqual(["consistent", "top"]);
  });

  it("excludes a one-time small giver who isn't in the top bracket", () => {
    const entries = [
      entry({ reference: "a", phone: "+233240000001", amountMinor: 50_000 }),
      entry({ reference: "b", phone: "+233240000002", amountMinor: 10 }),
    ];
    const candidates = buildCallCandidates(entries, 1);
    expect(candidates.find((c) => c.phone === "+233240000002")).toBeUndefined();
  });

  it("excludes bank/interop statement rows — there's no one to call", () => {
    const entries = [
      entry({
        reference: "a",
        phone: null,
        isStatement: true,
        amountMinor: 999_999,
        name: "Ecobank MobileApp",
      }),
      entry({ reference: "b", phone: "+233240000001" }),
      entry({ reference: "c", phone: "+233240000001" }),
    ];
    const candidates = buildCallCandidates(entries, 5);
    expect(candidates.every((c) => c.name !== "Ecobank MobileApp")).toBe(true);
  });

  it("excludes a gift with no phone at all — can't be called", () => {
    const entries = [
      entry({ reference: "a", phone: null }),
      entry({ reference: "b", phone: null }),
    ];
    expect(buildCallCandidates(entries, 5)).toHaveLength(0);
  });

  it("sums gift count and total across every gift from the same phone", () => {
    const entries = [
      entry({ reference: "a", phone: "+233240000001", amountMinor: 1_000 }),
      entry({ reference: "b", phone: "+233240000001", amountMinor: 2_000 }),
      entry({ reference: "c", phone: "+233240000001", amountMinor: 3_000 }),
    ];
    const [c] = buildCallCandidates(entries, 0);
    expect(c.giftCount).toBe(3);
    expect(c.totalMinor).toBe(6_000);
  });

  it("backfills branch/country once a later gift resolves them, instead of staying unattributed", () => {
    const entries = [
      entry({
        reference: "a",
        phone: "+233240000001",
        branch: UNATTRIBUTED,
        country: "—",
      }),
      entry({
        reference: "b",
        phone: "+233240000001",
        branch: "Qodesh",
        country: "Ghana",
      }),
    ];
    const [c] = buildCallCandidates(entries, 0);
    expect(c.branch).toBe("Qodesh");
    expect(c.country).toBe("Ghana");
  });

  it("sorts candidates by total descending", () => {
    const entries = [
      entry({ reference: "a", phone: "+233240000001", amountMinor: 1_000 }),
      entry({ reference: "b", phone: "+233240000001", amountMinor: 1_000 }),
      entry({ reference: "c", phone: "+233240000002", amountMinor: 9_000 }),
      entry({ reference: "d", phone: "+233240000002", amountMinor: 9_000 }),
    ];
    const candidates = buildCallCandidates(entries, 0);
    expect(candidates.map((c) => c.phone)).toEqual([
      "+233240000002",
      "+233240000001",
    ]);
  });
});

describe("filterCallCandidates", () => {
  const consistentOnly: CallCandidate = {
    phone: "+233240000001",
    name: "Consistent Giver",
    branch: "Qodesh",
    country: "Ghana",
    giftCount: 3,
    totalMinor: 300,
    currency: "GHS",
    reasons: ["consistent"],
  };
  const topOnly: CallCandidate = {
    phone: "+233240000002",
    name: "Top Giver",
    branch: "Qodesh",
    country: "Ghana",
    giftCount: 1,
    totalMinor: 100_000,
    currency: "GHS",
    reasons: ["top"],
  };
  const both: CallCandidate = {
    ...consistentOnly,
    phone: "+233240000003",
    reasons: ["consistent", "top"],
  };
  const candidates = [consistentOnly, topOnly, both];

  it("defaults to showing anyone matching either criterion", () => {
    expect(filterCallCandidates(candidates, {}).map((c) => c.phone)).toEqual(
      candidates.map((c) => c.phone),
    );
  });

  it("narrows to only top givers when consistent is unchecked", () => {
    const result = filterCallCandidates(candidates, {
      consistent: false,
      top: true,
    });
    expect(result.map((c) => c.phone)).toEqual([topOnly.phone, both.phone]);
  });

  it("narrows to only consistent givers when top is unchecked", () => {
    const result = filterCallCandidates(candidates, {
      consistent: true,
      top: false,
    });
    expect(result.map((c) => c.phone)).toEqual([
      consistentOnly.phone,
      both.phone,
    ]);
  });

  it("returns nothing when both criteria are unchecked", () => {
    expect(
      filterCallCandidates(candidates, { consistent: false, top: false }),
    ).toEqual([]);
  });
});
