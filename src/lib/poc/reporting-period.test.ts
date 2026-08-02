import { describe, expect, it } from "vitest";
import type { ReconciliationResult } from "../reconcile";
import {
  filterReconciliationByPeriod,
  reportingPeriod,
} from "./reporting-period";

function resultWithDates(dates: string[]): ReconciliationResult {
  return {
    registeredPaid: dates.map((paidAt, index) => ({
      registration: {
        id: `partner-${index}`,
        fullName: `Partner ${index}`,
        phone: `+2332000000${index}`,
      },
      payments: [
        {
          reference: `gift-${index}`,
          payerName: `Partner ${index}`,
          payerPhone: `+2332000000${index}`,
          amountMinor: 500,
          currency: "GHS",
          paidAt,
        },
      ],
      totalMinor: 500,
    })),
    paidUnregistered: [],
    registeredUnpaid: [],
    statementRows: [],
  };
}

describe("reportingPeriod", () => {
  it("names a cross-month window from the earliest and latest gift", () => {
    expect(
      reportingPeriod(
        resultWithDates([
          "2026-07-21T12:16:28.672+00:00",
          "2026-06-01T03:00:00+00:00",
        ]),
      ),
    ).toMatchObject({
      label: "June 1 – July 21, 2026",
      compactLabel: "Jun 1 – Jul 21, 2026",
    });
  });

  it("includes statement-only dates in the loaded giving window", () => {
    const result = resultWithDates(["2026-07-10"]);
    result.statementRows.push({
      reference: "statement-1",
      payerName: "Bank transfer",
      payerPhone: null,
      amountMinor: 1000,
      currency: "GHS",
      paidAt: "2026-06-15",
    });

    expect(reportingPeriod(result).label).toBe("June 15 – July 10, 2026");
  });

  it("formats a range within one month without an incomplete Intl label", () => {
    const result = resultWithDates([
      "2026-07-01T00:00:00.000Z",
      "2026-07-21T00:00:00.000Z",
    ]);

    expect(reportingPeriod(result).label).toBe("July 1–21, 2026");
    expect(reportingPeriod(result).compactLabel).toBe("Jul 1–21, 2026");
  });

  it("states clearly when no dated giving records are loaded", () => {
    expect(reportingPeriod(resultWithDates([]))).toMatchObject({
      start: null,
      end: null,
      label: "No giving data loaded",
    });
  });
});

describe("filterReconciliationByPeriod", () => {
  it("moves a registered giver into the unpaid group when their gift is outside the selected dates", () => {
    const result = resultWithDates([
      "2026-06-05T10:00:00Z",
      "2026-07-05T10:00:00Z",
    ]);
    const filtered = filterReconciliationByPeriod(result, {
      from: "2026-07-01",
      to: "2026-07-31",
    });

    expect(
      filtered.registeredPaid.map((giver) => giver.registration.id),
    ).toEqual(["partner-1"]);
    expect(filtered.registeredUnpaid.map((partner) => partner.id)).toEqual([
      "partner-0",
    ]);
  });

  it("recalculates a giver total from only payments inside the selected dates", () => {
    const result = resultWithDates(["2026-07-05T10:00:00Z"]);
    result.registeredPaid[0].payments.push({
      ...result.registeredPaid[0].payments[0],
      reference: "old-gift",
      paidAt: "2026-06-05T10:00:00Z",
      amountMinor: 900,
    });
    result.registeredPaid[0].totalMinor = 1400;

    const filtered = filterReconciliationByPeriod(result, {
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(filtered.registeredPaid[0].totalMinor).toBe(500);
    expect(filtered.registeredPaid[0].payments).toHaveLength(1);
  });
});
