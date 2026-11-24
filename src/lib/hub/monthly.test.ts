import { describe, expect, it } from "vitest";
import {
  buildHubMonth,
  buildMonthTrail,
  monthsEndingAt,
  type HubMonthlyInput,
} from "./monthly";

const report = (
  church_id: string,
  reporting_month: string,
  given_usd_cents: number,
  counts: [number, number, number, number],
  submitted_at = "2026-11-02T09:00:00Z",
) => ({
  church_id,
  reporting_month,
  given_usd_cents,
  submitted_at,
  total_registered: counts[0],
  active_partners: counts[1],
  new_registrations: counts[2],
  lapsed: counts[3],
});

const input: HubMonthlyInput = {
  churches: [
    { id: "c-b", name: "Bethel", leader_name: "Ps Ama" },
    { id: "c-a", name: "Agape", leader_name: null },
    { id: "c-c", name: "Calvary", leader_name: "Ps Kofi" },
  ],
  reports: [
    report("c-a", "2026-10-01", 30000, [40, 30, 2, 1]),
    // Filed in November for October: counts in October.
    report("c-b", "2026-10-01", 12500, [20, 15, 1, 0], "2026-11-09T09:00:00Z"),
    report("c-a", "2026-09-01", 25000, [38, 29, 3, 2], "2026-10-02T09:00:00Z"),
  ],
};

describe("buildHubMonth", () => {
  const m = buildHubMonth(input, "2026-10");

  it("splits churches into submitted and not submitted, alphabetically, with what each reported", () => {
    expect(m.filed.map((r) => [r.name, r.givenUsdCents, r.counts])).toEqual([
      [
        "Agape",
        30000,
        { totalRegistered: 40, activePartners: 30, newRegistrations: 2, lapsed: 1 },
      ],
      [
        "Bethel",
        12500,
        { totalRegistered: 20, activePartners: 15, newRegistrations: 1, lapsed: 0 },
      ],
    ]);
    expect(m.notFiled.map((r) => [r.name, r.pastor, r.counts])).toEqual([
      ["Calvary", "Ps Kofi", null],
    ]);
  });

  it("adds up the four numbers and the giving across the churches that submitted", () => {
    expect(m.summaryTotals).toEqual({
      totalRegistered: 60,
      activePartners: 45,
      newRegistrations: 3,
      lapsed: 1,
    });
    expect(m.givenUsdCents).toBe(42500);
  });

  it("uses the reporting month, not the date the form was filed", () => {
    expect(m.filed[1].filedAt).toBe("2026-11-09T09:00:00Z");
    expect(buildHubMonth(input, "2026-11").filed).toEqual([]);
  });
});

describe("month by month", () => {
  it("lists the chosen month and the ones before it", () => {
    expect(monthsEndingAt("2026-02", 3)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("summarises each month", () => {
    expect(buildMonthTrail(input, ["2026-10", "2026-09"])).toEqual([
      {
        month: "2026-09",
        givenUsdCents: 25000,
        filed: 1,
        churches: 3,
        summaryTotals: {
          totalRegistered: 38,
          activePartners: 29,
          newRegistrations: 3,
          lapsed: 2,
        },
      },
      {
        month: "2026-10",
        givenUsdCents: 42500,
        filed: 2,
        churches: 3,
        summaryTotals: {
          totalRegistered: 60,
          activePartners: 45,
          newRegistrations: 3,
          lapsed: 1,
        },
      },
    ]);
  });
});
