import { describe, expect, it } from "vitest";
import {
  buildCallCandidates,
  buildMonthlyCallList,
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
    expect(candidates).toHaveLength(2);
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

  it("tags a one-time non-top giver as ordinary", () => {
    const entries = [
      entry({ reference: "a", phone: "+233240000001", amountMinor: 50_000 }),
      entry({ reference: "b", phone: "+233240000002", amountMinor: 10 }),
    ];
    const candidates = buildCallCandidates(entries, 1);
    const ordinary = candidates.find((c) => c.phone === "+233240000002");
    expect(ordinary?.reasons).toEqual(["ordinary"]);
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
  const ordinaryOnly: CallCandidate = {
    phone: "+233240000004",
    name: "Ordinary Giver",
    branch: "Qodesh",
    country: "Ghana",
    giftCount: 1,
    totalMinor: 100,
    currency: "GHS",
    reasons: ["ordinary"],
  };
  const both: CallCandidate = {
    ...consistentOnly,
    phone: "+233240000003",
    reasons: ["consistent", "top"],
  };
  const candidates = [consistentOnly, topOnly, ordinaryOnly, both];

  it("defaults to showing anyone matching any enabled criterion", () => {
    expect(filterCallCandidates(candidates, {}).map((c) => c.phone)).toEqual(
      candidates.map((c) => c.phone),
    );
  });

  it("narrows to only top givers when consistent and ordinary are unchecked", () => {
    const result = filterCallCandidates(candidates, {
      consistent: false,
      top: true,
      ordinary: false,
    });
    expect(result.map((c) => c.phone)).toEqual([topOnly.phone, both.phone]);
  });

  it("narrows to only consistent givers when top and ordinary are unchecked", () => {
    const result = filterCallCandidates(candidates, {
      consistent: true,
      top: false,
      ordinary: false,
    });
    expect(result.map((c) => c.phone)).toEqual([
      consistentOnly.phone,
      both.phone,
    ]);
  });

  it("narrows to only ordinary givers", () => {
    const result = filterCallCandidates(candidates, {
      consistent: false,
      top: false,
      ordinary: true,
    });
    expect(result.map((c) => c.phone)).toEqual([ordinaryOnly.phone]);
  });

  it("returns nothing when all criteria are unchecked", () => {
    expect(
      filterCallCandidates(candidates, {
        consistent: false,
        top: false,
        ordinary: false,
      }),
    ).toEqual([]);
  });
});

describe("buildMonthlyCallList", () => {
  function buildEntries(): GivingEntry[] {
    const rows: GivingEntry[] = [];

    for (let i = 0; i < 12; i += 1) {
      rows.push(
        entry({
          reference: `top-${i}`,
          phone: `+233240100${String(i).padStart(3, "0")}`,
          name: `Top ${i}`,
          amountMinor: 100_000 - i * 500,
        }),
      );
    }

    for (let i = 0; i < 12; i += 1) {
      const phone = `+233240200${String(i).padStart(3, "0")}`;
      rows.push(
        entry({
          reference: `repeat-${i}-1`,
          phone,
          name: `Repeat ${i}`,
          amountMinor: 4_000 + i,
        }),
        entry({
          reference: `repeat-${i}-2`,
          phone,
          name: `Repeat ${i}`,
          amountMinor: 4_000 + i,
        }),
      );
    }

    for (let i = 0; i < 24; i += 1) {
      rows.push(
        entry({
          reference: `ordinary-${i}`,
          phone: `+233240300${String(i).padStart(3, "0")}`,
          name: `Ordinary ${i}`,
          amountMinor: 500 + i,
        }),
      );
    }

    return rows;
  }

  it("returns a deterministic 20-person shortlist for a month", () => {
    const candidates = buildCallCandidates(buildEntries(), 12);
    const augustA = buildMonthlyCallList(
      candidates,
      { consistent: true, top: true, ordinary: true },
      { monthKey: "2026-08", size: 20 },
    );
    const augustB = buildMonthlyCallList(
      candidates,
      { consistent: true, top: true, ordinary: true },
      { monthKey: "2026-08", size: 20 },
    );

    expect(augustA.map((c) => c.phone)).toEqual(augustB.map((c) => c.phone));
    expect(augustA).toHaveLength(20);
    expect(new Set(augustA.map((c) => c.phone)).size).toBe(20);
    expect(augustA.some((c) => c.reasons.includes("top"))).toBe(true);
    expect(augustA.some((c) => c.reasons.includes("consistent"))).toBe(true);
    expect(augustA.some((c) => c.reasons.includes("ordinary"))).toBe(true);
  });

  it("honors enabled filters when composing the shortlist", () => {
    const candidates = buildCallCandidates(buildEntries(), 12);
    const topOnly = buildMonthlyCallList(
      candidates,
      { consistent: false, top: true, ordinary: false },
      { monthKey: "2026-08", size: 20 },
    );

    expect(topOnly.length).toBeGreaterThan(0);
    expect(topOnly.every((c) => c.reasons.includes("top"))).toBe(true);
  });
});
