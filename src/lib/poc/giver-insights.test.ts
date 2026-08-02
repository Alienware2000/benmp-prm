import { describe, expect, it } from "vitest";
import type { ReconciliationResult } from "../reconcile";
import { giverInsightGroups } from "./giver-insights";

const result: ReconciliationResult = {
  registeredPaid: [
    {
      registration: {
        id: "top",
        fullName: "Top Giver",
        phone: "+233240000001",
      },
      totalMinor: 12_000,
      payments: [
        {
          reference: "t1",
          payerName: "Top Giver",
          payerPhone: "+233240000001",
          amountMinor: 6_000,
          currency: "GHS",
          paidAt: "2026-07-01",
        },
        {
          reference: "t2",
          payerName: "Top Giver",
          payerPhone: "+233240000001",
          amountMinor: 6_000,
          currency: "GHS",
          paidAt: "2026-07-02",
        },
      ],
    },
    {
      registration: {
        id: "consistent",
        fullName: "Consistent Giver",
        phone: "+233240000002",
      },
      totalMinor: 8_000,
      payments: [
        {
          reference: "c1",
          payerName: "Consistent Giver",
          payerPhone: "+233240000002",
          amountMinor: 4_000,
          currency: "GHS",
          paidAt: "2026-06-01",
        },
        {
          reference: "c2",
          payerName: "Consistent Giver",
          payerPhone: "+233240000002",
          amountMinor: 4_000,
          currency: "GHS",
          paidAt: "2026-07-02",
        },
      ],
    },
    {
      registration: {
        id: "ordinary",
        fullName: "Ordinary Giver",
        phone: "+233240000003",
      },
      totalMinor: 2_000,
      payments: [
        {
          reference: "o1",
          payerName: "Ordinary Giver",
          payerPhone: "+233240000003",
          amountMinor: 2_000,
          currency: "GHS",
          paidAt: "2026-07-03",
        },
      ],
    },
  ],
  paidUnregistered: [],
  registeredUnpaid: [],
  statementRows: [],
};

describe("giverInsightGroups", () => {
  it("assigns every giver to exactly one requested category", () => {
    const groups = giverInsightGroups(result, { topCount: 1 });
    expect(groups.top.map((giver) => giver.name)).toEqual(["Top Giver"]);
    expect(groups.consistent.map((giver) => giver.name)).toEqual([
      "Consistent Giver",
    ]);
    expect(groups.ordinary.map((giver) => giver.name)).toEqual([
      "Ordinary Giver",
    ]);
  });

  it("gives the top ranking precedence over multiple gifts", () => {
    const groups = giverInsightGroups(result, { topCount: 1 });
    expect(groups.top).toHaveLength(1);
    expect(groups.top[0].name).toBe("Top Giver");
    expect(groups.consistent.map((giver) => giver.name)).toEqual([
      "Consistent Giver",
    ]);
  });

  it("limits each dashboard view independently", () => {
    const groups = giverInsightGroups(result, { limit: 0 });
    expect(groups.top).toEqual([]);
    expect(groups.consistent).toEqual([]);
    expect(groups.ordinary).toEqual([]);
  });
});
