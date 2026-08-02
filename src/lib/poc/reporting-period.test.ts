import { describe, expect, it } from "vitest";
import type { ReconciliationResult } from "../reconcile";
import { reportingPeriod } from "./reporting-period";

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

  it("states clearly when no dated giving records are loaded", () => {
    expect(reportingPeriod(resultWithDates([]))).toMatchObject({
      start: null,
      end: null,
      label: "No giving data loaded",
    });
  });
});
