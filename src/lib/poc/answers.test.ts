import { describe, it, expect } from "vitest";
import {
  countsByBucket,
  totalCollectedMinor,
  unregisteredPayers,
  headlineAnswers,
} from "./answers";
import type { ReconciliationResult } from "../reconcile";

const result: ReconciliationResult = {
  registeredPaid: [
    { registration: { id: "reg_0", fullName: "Kofi", phone: "+233244000001" }, payments: [], totalMinor: 5000 },
    { registration: { id: "reg_1", fullName: "Ama", phone: "+233244000002" }, payments: [], totalMinor: 10000 },
  ],
  paidUnregistered: [
    {
      payment: { reference: "TXN2", payerName: "Kwesi Stranger", payerPhone: "+233209999999", amountMinor: 7550, currency: "GHS", paidAt: "2026-07-10" },
      suggestedName: "Kwesi Stranger",
      includeAndMessage: true,
    },
  ],
  registeredUnpaid: [
    { id: "reg_5", fullName: "Late One", phone: "+233244555000" },
    { id: "reg_6", fullName: "Late Two", phone: "+233244555001" },
  ],
};

describe("answers aggregations (what the AI cites)", () => {
  it("countsByBucket", () => {
    expect(countsByBucket(result)).toEqual({
      registeredPaid: 2,
      paidUnregistered: 1,
      registeredUnpaid: 2,
      totalPeople: 5,
    });
  });

  it("totalCollectedMinor sums registered + unregistered payments (integer minor units)", () => {
    expect(totalCollectedMinor(result)).toBe(22550); // 5000 + 10000 + 7550
  });

  it("unregisteredPayers lists the Bishop-Ebo payers", () => {
    expect(unregisteredPayers(result)).toEqual([
      { name: "Kwesi Stranger", amountMinor: 7550, reference: "TXN2", phone: "+233209999999" },
    ]);
  });

  it("headlineAnswers rolls up the four questions", () => {
    const a = headlineAnswers(result);
    expect(a.paidCount).toBe(3); // 2 registered + 1 unregistered
    expect(a.registeredPaidCount).toBe(2);
    expect(a.unregisteredCount).toBe(1);
    expect(a.unpaidCount).toBe(2);
    expect(a.totalPeople).toBe(5);
    expect(a.totalCollectedMinor).toBe(22550);
    expect(a.totalCollectedGhs).toBe("225.50");
    expect(a.unregistered).toHaveLength(1);
  });
});
