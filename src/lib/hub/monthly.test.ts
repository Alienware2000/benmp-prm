import { describe, expect, it } from "vitest";
import {
  buildHubMonth,
  buildMonthTrail,
  monthsEndingAt,
  type HubMonthlyInput,
} from "./monthly";

const input: HubMonthlyInput = {
  churches: [
    { id: "c-b", name: "Bethel", leader_name: "Ps Ama" },
    { id: "c-a", name: "Agape", leader_name: null },
    { id: "c-c", name: "Calvary", leader_name: "Ps Kofi" },
  ],
  partners: [
    { id: "p1", church_id: "c-a" },
    { id: "p2", church_id: "c-a" },
    { id: "p3", church_id: "c-b" },
    { id: "p4", church_id: null },
  ],
  payments: [
    {
      partner_id: "p1",
      paid_at: "2026-10-03T10:00:00Z",
      amount_minor: 5000,
      payment_method: "mobile_money",
      raw_method: null,
      raw_source: null,
    },
    {
      partner_id: "p1",
      paid_at: "2026-10-20T10:00:00Z",
      amount_minor: 2000,
      payment_method: null,
      raw_method: "bank_transfer",
      raw_source: null,
    },
    {
      partner_id: "p3",
      paid_at: "2026-10-05T10:00:00Z",
      amount_minor: 10000,
      payment_method: "paystack_card",
      raw_method: null,
      raw_source: null,
    },
    {
      partner_id: "p4",
      paid_at: "2026-10-07T10:00:00Z",
      amount_minor: 700,
      payment_method: "mobile_money",
      raw_method: null,
      raw_source: null,
    },
    // Promoted cash already counted from the cash report: must not be added again.
    {
      partner_id: "p2",
      paid_at: "2026-10-09T10:00:00Z",
      amount_minor: 99900,
      payment_method: "cash",
      raw_method: "cash",
      raw_source: "cash_submission",
    },
    // Older import: the method is only in raw_row.source.
    {
      partner_id: "p3",
      paid_at: "2026-10-11T10:00:00Z",
      amount_minor: 1000,
      payment_method: null,
      raw_method: null,
      raw_source: "ecobank",
    },
    // Another month.
    {
      partner_id: "p2",
      paid_at: "2026-09-30T23:00:00Z",
      amount_minor: 3000,
      payment_method: "mobile_money",
      raw_method: null,
      raw_source: null,
    },
  ],
  cashReports: [
    {
      church_id: "c-b",
      reporting_month: "2026-10-01",
      total_cash_minor: 40000,
      submitted_at: "2026-11-02T09:00:00Z",
      total_registered: 120,
      active_partners: 80,
      new_registrations: 5,
      lapsed: 3,
    },
    // A form with the summary only (no cash).
    {
      church_id: "c-c",
      reporting_month: "2026-10-01",
      total_cash_minor: 0,
      submitted_at: "2026-11-03T09:00:00Z",
      total_registered: 30,
      active_partners: 12,
      new_registrations: 2,
      lapsed: 0,
    },
    {
      church_id: "c-a",
      reporting_month: "2026-09-01",
      total_cash_minor: 15000,
      submitted_at: "2026-10-01T09:00:00Z",
      total_registered: 50,
      active_partners: 40,
      new_registrations: 1,
      lapsed: 1,
    },
  ],
};

describe("buildHubMonth", () => {
  const m = buildHubMonth(input, "2026-10");

  it("totals statement giving by method, leaving ledger cash to the cash reports", () => {
    expect(m.statementByMethod).toEqual({
      mobile_money: 5700,
      bank: 3000,
      paystack: 10000,
      other: 0,
    });
    expect(m.statementMinor).toBe(18700);
    expect(m.cashMinor).toBe(40000);
    expect(m.totalMinor).toBe(58700);
    expect(m.givers).toBe(3);
  });

  it("splits churches into submitted and not submitted, alphabetically, with their own figures", () => {
    expect(m.filed[0]).toEqual({
      churchId: "c-b",
      name: "Bethel",
      pastor: "Ps Ama",
      partners: 1,
      statementMinor: 11000,
      cashMinor: 40000,
      filedAt: "2026-11-02T09:00:00Z",
      counts: {
        totalRegistered: 120,
        activePartners: 80,
        newRegistrations: 5,
        lapsed: 3,
      },
    });
    expect(m.filed.map((row) => row.name)).toEqual(["Bethel", "Calvary"]);
    expect(
      m.notFiled.map((row) => [
        row.name,
        row.partners,
        row.statementMinor,
        row.counts,
      ]),
    ).toEqual([["Agape", 2, 7000, null]]);
  });

  it("adds up the four numbers across the churches that submitted", () => {
    expect(m.summaryTotals).toEqual({
      totalRegistered: 150,
      activePartners: 92,
      newRegistrations: 7,
      lapsed: 3,
    });
  });

  it("keeps giving from partners without a church visible", () => {
    expect(m.noChurchMinor).toBe(700);
  });

  it("uses the reporting month for cash, not the date it was filed", () => {
    const september = buildHubMonth(input, "2026-09");
    expect(september.filed.map((row) => row.name)).toEqual(["Agape"]);
    expect(september.cashMinor).toBe(15000);
    expect(september.statementMinor).toBe(3000);
  });
});

describe("month by month", () => {
  it("lists the chosen month and the ones before it", () => {
    expect(monthsEndingAt("2026-02", 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("summarises each month", () => {
    expect(buildMonthTrail(input, ["2026-10", "2026-09"])).toEqual([
      {
        month: "2026-09",
        statementMinor: 3000,
        cashMinor: 15000,
        totalMinor: 18000,
        filed: 1,
        churches: 3,
        summaryTotals: {
          totalRegistered: 50,
          activePartners: 40,
          newRegistrations: 1,
          lapsed: 1,
        },
      },
      {
        month: "2026-10",
        statementMinor: 18700,
        cashMinor: 40000,
        totalMinor: 58700,
        filed: 2,
        churches: 3,
        summaryTotals: {
          totalRegistered: 150,
          activePartners: 92,
          newRegistrations: 7,
          lapsed: 3,
        },
      },
    ]);
  });
});
