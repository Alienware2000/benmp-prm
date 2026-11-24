import { describe, expect, it } from "vitest";
import {
  metricSeries,
  monthlyTotals,
  resolveMetric,
  sumForms,
  totalsBy,
  type FormRow,
} from "./admins-metrics";

const form = (
  church_id: string,
  hub_id: string,
  region_id: string,
  month: string,
  counts: [number, number, number, number],
  given_usd_cents = 0,
): FormRow => ({
  church_id,
  hub_id,
  region_id,
  reporting_month: `${month}-01`,
  total_registered: counts[0],
  active_partners: counts[1],
  new_registrations: counts[2],
  lapsed: counts[3],
  given_usd_cents,
  status: "submitted",
});

const rows = [
  form("c1", "h1", "r-ud", "2026-10", [40, 30, 2, 1], 30000),
  form("c2", "h1", "r-ud", "2026-10", [20, 15, 1, 0], 12500),
  form("c3", "h2", "r-uj", "2026-10", [10, 8, 0, 3]),
  form("c1", "h1", "r-ud", "2026-09", [38, 29, 3, 2]),
];

describe("Admins four numbers (Decision 0045)", () => {
  it("adds up the four numbers, the giving and the form count", () => {
    expect(sumForms(rows.slice(0, 3))).toEqual({
      totalRegistered: 70,
      activePartners: 53,
      newRegistrations: 3,
      lapsed: 4,
      forms: 3,
      givenUsdCents: 42500,
    });
  });

  it("splits a month's totals by block, hub or church", () => {
    const byRegion = totalsBy(rows, "2026-10", (r) => r.region_id);
    expect(byRegion.get("r-ud")?.totalRegistered).toBe(60);
    expect(byRegion.get("r-uj")?.lapsed).toBe(3);
    expect(totalsBy(rows, "2026-10", (r) => r.hub_id).get("h1")?.forms).toBe(2);
    expect(totalsBy(rows, "2026-11", (r) => r.hub_id).size).toBe(0);
  });

  it("gives one value per month for the chart, zero where nothing was filed", () => {
    expect(
      metricSeries(rows, ["2026-08", "2026-09", "2026-10"], "activePartners"),
    ).toEqual([
      { month: "2026-08", value: 0, forms: 0 },
      { month: "2026-09", value: 29, forms: 1 },
      { month: "2026-10", value: 53, forms: 3 },
    ]);
  });

  it("reads the metric from the address, total registered by default", () => {
    expect(resolveMetric("lapsed")).toBe("lapsed");
    expect(resolveMetric(["newRegistrations"])).toBe("newRegistrations");
    expect(resolveMetric("nonsense")).toBe("totalRegistered");
    expect(resolveMetric(undefined)).toBe("totalRegistered");
  });

  it("gives every month's four numbers and dollars for the two charts", () => {
    const t = monthlyTotals(rows, ["2026-09", "2026-10"]);
    expect(
      t.map((m) => [
        m.month,
        m.totalRegistered,
        m.lapsed,
        m.givenUsdCents,
        m.forms,
      ]),
    ).toEqual([
      ["2026-09", 38, 2, 0, 1],
      ["2026-10", 70, 4, 42500, 3],
    ]);
  });
});
