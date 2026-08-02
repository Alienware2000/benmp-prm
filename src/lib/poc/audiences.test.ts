import { describe, expect, it } from "vitest";
import type { ReconciliationResult } from "../reconcile";
import type { DirectoryPartner } from "./directory";
import {
  audienceCounts,
  dedupeAudiencePartners,
  filterAudienceByAmount,
  isAudienceKey,
  reconciliationAudiencePartners,
} from "./audiences";

const result: ReconciliationResult = {
  registeredPaid: [
    {
      registration: {
        id: "paid-1",
        fullName: "Ama Paid",
        phone: "+233240000001",
      },
      totalMinor: 20_000,
      payments: [
        {
          reference: "pay-1",
          payerName: "Ama Paid",
          payerPhone: "+233240000001",
          amountMinor: 20_000,
          currency: "GHS",
          paidAt: "2026-07-01",
        },
      ],
    },
    {
      registration: {
        id: "paid-2",
        fullName: "Kofi Consistent",
        phone: "+233240000002",
      },
      totalMinor: 8_000,
      payments: [
        {
          reference: "pay-2a",
          payerName: "Kofi Consistent",
          payerPhone: "+233240000002",
          amountMinor: 4_000,
          currency: "GHS",
          paidAt: "2026-06-01",
        },
        {
          reference: "pay-2b",
          payerName: "Kofi Consistent",
          payerPhone: "+233240000002",
          amountMinor: 4_000,
          currency: "GHS",
          paidAt: "2026-07-02",
        },
      ],
    },
  ],
  paidUnregistered: [
    {
      payments: [
        {
          reference: "new-1",
          payerName: "New Partner",
          payerPhone: "+233240000003",
          amountMinor: 2_000,
          currency: "GHS",
          paidAt: "2026-07-03",
        },
      ],
      totalMinor: 2_000,
      phone: "+233240000003",
      suggestedName: "New Partner",
      includeAndMessage: true,
    },
  ],
  registeredUnpaid: [
    { id: "unpaid-1", fullName: "Esi Unpaid", phone: "+233240000004" },
  ],
  statementRows: [],
};

function partner(overrides: Partial<DirectoryPartner>): DirectoryPartner {
  return {
    id: "partner-1",
    name: "Ama",
    phone: "+233240000001",
    branch: "Qodesh",
    country: "Ghana",
    givenMinor: 0,
    messageable: true,
    ...overrides,
  };
}

describe("message audiences", () => {
  it("recognizes only supported audience keys", () => {
    expect(isAudienceKey("everyone")).toBe(true);
    expect(isAudienceKey("top")).toBe(true);
    expect(isAudienceKey("branch-east")).toBe(false);
  });

  it("counts the primary and giver-specific cohorts", () => {
    const counts = audienceCounts(result, 26_092);
    expect(counts).toMatchObject({
      everyone: 26_092,
      paid: 3,
      unpaid: 1,
      top: 3,
      consistent: 0,
      new: 1,
    });
  });

  it("builds the new-giver cohort with recorded amounts", () => {
    expect(reconciliationAudiencePartners(result, "new")).toEqual([
      expect.objectContaining({
        name: "New Partner",
        phone: "+233240000003",
        givenMinor: 2_000,
      }),
    ]);
  });

  it("deduplicates messageable records by WhatsApp number", () => {
    const deduped = dedupeAudiencePartners([
      partner({ id: "a", givenMinor: 1_000 }),
      partner({ id: "b", givenMinor: 3_000 }),
      partner({ id: "c", phone: null, messageable: false }),
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]).toMatchObject({ id: "b", givenMinor: 3_000 });
    expect(deduped[1].phone).toBeNull();
  });

  it("applies inclusive amount refinement", () => {
    const filtered = filterAudienceByAmount(
      [
        partner({ id: "low", givenMinor: 1_000 }),
        partner({ id: "middle", givenMinor: 5_000 }),
        partner({ id: "high", givenMinor: 10_000 }),
      ],
      { minAmountMinor: 5_000, maxAmountMinor: 10_000 },
    );
    expect(filtered.map((item) => item.id)).toEqual(["middle", "high"]);
  });
});
