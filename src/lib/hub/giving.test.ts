import { describe, expect, it } from "vitest";
import {
  activeWindowStart,
  summarizeHubGiving,
  type HubGivingPartner,
} from "./giving";

const partner = (id: string): HubGivingPartner => ({
  id,
  fullName: `Partner ${id}`,
  phone: null,
  church: null,
});
const today = new Date("2026-10-14T12:00:00Z");

describe("activeWindowStart", () => {
  it("is the 1st of the month two months back", () => {
    expect(activeWindowStart(today)).toBe("2026-08-01");
  });
  it("crosses the year boundary", () => {
    expect(activeWindowStart(new Date("2027-01-20T00:00:00Z"))).toBe(
      "2026-11-01",
    );
  });
});

describe("summarizeHubGiving", () => {
  it("splits partners into active, lapsed and never given", () => {
    const summary = summarizeHubGiving(
      [partner("a"), partner("b"), partner("c")],
      [
        { partnerId: "a", paidAt: "2026-08-01T09:00:00Z", amountMinor: 1000 },
        { partnerId: "b", paidAt: "2026-07-31T23:00:00Z", amountMinor: 500 },
      ],
      today,
    );
    expect(summary).toMatchObject({
      partnerCount: 3,
      activeCount: 1,
      lapsedCount: 1,
      neverCount: 1,
      activeSince: "2026-08-01",
    });
    expect(summary.givers.map((g) => [g.id, g.status])).toEqual([
      ["a", "active"],
      ["b", "lapsed"],
    ]);
  });

  it("uses each partner's most recent gift and sorts newest first", () => {
    const summary = summarizeHubGiving(
      [partner("a"), partner("b")],
      [
        { partnerId: "a", paidAt: "2026-05-01T00:00:00Z", amountMinor: 100 },
        { partnerId: "a", paidAt: "2026-09-10T00:00:00Z", amountMinor: 100 },
        { partnerId: "b", paidAt: "2026-09-20T00:00:00Z", amountMinor: 100 },
      ],
      today,
    );
    expect(summary.givers.map((g) => [g.id, g.lastGiftAt])).toEqual([
      ["b", "2026-09-20T00:00:00Z"],
      ["a", "2026-09-10T00:00:00Z"],
    ]);
    expect(summary.activeCount).toBe(2);
  });

  it("totals the active window and the year", () => {
    const summary = summarizeHubGiving(
      [partner("a")],
      [
        { partnerId: "a", paidAt: "2025-12-31T00:00:00Z", amountMinor: 9999 },
        { partnerId: "a", paidAt: "2026-03-01T00:00:00Z", amountMinor: 200 },
        { partnerId: "a", paidAt: "2026-09-01T00:00:00Z", amountMinor: 300 },
      ],
      today,
    );
    expect(summary.activeWindowMinor).toBe(300);
    expect(summary.yearMinor).toBe(500);
  });

  it("ignores payments for partners outside the hub", () => {
    const summary = summarizeHubGiving(
      [partner("a")],
      [{ partnerId: "z", paidAt: "2026-09-01T00:00:00Z", amountMinor: 300 }],
      today,
    );
    expect(summary).toMatchObject({
      activeCount: 0,
      neverCount: 1,
      yearMinor: 0,
    });
  });
});
