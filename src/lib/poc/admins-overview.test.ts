import { describe, it, expect } from "vitest";
import {
  ADMIN_BLOCKS,
  buildBlocks,
  buildHubReport,
  computeHubStats,
  hubsForRegion,
  resolveMonth,
  type AdminsInput,
} from "./admins-overview";

function input(): AdminsInput {
  return {
    regions: [
      { id: "r-ud", code: "UD_GHANA", name: "UD Ghana" },
      { id: "r-af", code: "AFRICA", name: "Africa" },
    ],
    hubs: [
      {
        id: "h8",
        name: "Cape Coast",
        hub_number: 8,
        region_id: "r-ud",
        leader_name: "Ps Ama",
      },
      {
        id: "h2",
        name: "Sefwi-Wiawso",
        hub_number: 2,
        region_id: "r-ud",
        leader_name: "Ps Kofi",
      },
      {
        id: "hk",
        name: "Kenya",
        hub_number: null,
        region_id: "r-af",
        leader_name: "Bishop Otieno",
      },
    ],
    accounts: [
      { hub_id: "h8", last_login_at: "2026-10-20T09:00:00Z" },
      { hub_id: "h2", last_login_at: null },
      { hub_id: "hk", last_login_at: "2026-10-01T09:00:00Z" },
    ],
    churches: [
      {
        id: "c-lion",
        name: "Lion of Judah",
        hub_id: "h8",
        leader_name: "Bishop Paschal",
      },
      { id: "c-abura", name: "Abura", hub_id: "h8", leader_name: null },
      { id: "c-asafo", name: "Sefwi Asafo", hub_id: "h2" },
      { id: "c-nai", name: "Nairobi", hub_id: "hk" },
    ],
    partners: [
      { id: "p1", hub_id: "h8", church_id: "c-lion", country: "Ghana" },
      { id: "p2", hub_id: "h8", church_id: "c-lion", country: "Ghana" },
      { id: "p3", hub_id: "h8", church_id: "c-abura", country: "Ghana" },
      { id: "p4", hub_id: "h8", church_id: null, country: "Ghana" },
      { id: "p5", hub_id: "h2", church_id: "c-asafo", country: "Ghana" },
      { id: "p6", hub_id: "hk", church_id: "c-nai", country: "Kenya" },
      { id: "p7", hub_id: null, church_id: null, country: "Ghana" },
    ],
    payments: [
      {
        amount_minor: 10000,
        payment_method: "mtn_momo",
        raw_row: { matched_partner_id: "p1" },
        paid_at: "2026-10-03T10:00:00Z",
      },
      {
        amount_minor: 5000,
        payment_method: "mtn_momo",
        raw_row: { matched_partner_id: "p3" },
        paid_at: "2026-10-05T10:00:00Z",
      },
      {
        amount_minor: 2000,
        payment_method: "mtn_momo",
        raw_row: { matched_partner_id: "p4" },
        paid_at: "2026-10-06T10:00:00Z",
      },
      // September: must not count for October.
      {
        amount_minor: 99900,
        payment_method: "mtn_momo",
        raw_row: { matched_partner_id: "p1" },
        paid_at: "2026-09-30T23:00:00Z",
      },
      // A giver with no hub: belongs to no block.
      {
        amount_minor: 7000,
        payment_method: "mtn_momo",
        raw_row: { matched_partner_id: "p7" },
        paid_at: "2026-10-07T10:00:00Z",
      },
    ],
    cashSubmissions: [
      { church_id: "c-lion", total_cash_minor: 45000, status: "submitted" },
    ],
  };
}

const OCT = "2026-10";

describe("office Admins tab (Decision 0036)", () => {
  it("shows the office's nine blocks in the order and names it asked for", () => {
    const blocks = buildBlocks(input().regions, computeHubStats(input(), OCT));
    expect(blocks.map((b) => b.label)).toEqual([
      "UD GH",
      "UJ",
      "RSC",
      "UD AF",
      "UD EU",
      "UD NA",
      "Eschatos Int",
      "UI",
      "First Love",
    ]);
    expect(ADMIN_BLOCKS).toHaveLength(9);
  });

  it("marks blocks without a region as not set up, with zero figures", () => {
    const blocks = buildBlocks(input().regions, computeHubStats(input(), OCT));
    const byLabel = Object.fromEntries(blocks.map((b) => [b.label, b]));
    for (const label of ["UD NA", "UI", "First Love", "UJ"]) {
      expect(byLabel[label].setUp).toBe(false);
      expect(byLabel[label].hubs).toBe(0);
      expect(byLabel[label].givingMinor).toBe(0);
    }
    expect(byLabel["UD GH"].setUp).toBe(true);
  });

  it("adds a region the list does not name yet at the end, so nothing is hidden", () => {
    const regions = [
      ...input().regions,
      { id: "r-x", code: "NEW_REGION", name: "New Region" },
    ];
    const blocks = buildBlocks(regions, computeHubStats(input(), OCT));
    expect(blocks.at(-1)).toMatchObject({
      label: "New Region",
      regionCode: "NEW_REGION",
      setUp: true,
      hubs: 0,
    });
  });

  it("totals each block from its hubs: partners, branches, admins, cash filed, giving", () => {
    const ud = buildBlocks(input().regions, computeHubStats(input(), OCT))[0];
    expect(ud).toMatchObject({
      hubs: 2,
      adminsSignedIn: 1, // Cape Coast signed in; Sefwi-Wiawso never has
      partners: 5, // p1-p5; p7 has no hub
      branches: 3,
      cashFiled: 1,
      givingMinor: 17000, // October only; the no-hub giver is not in any block
    });
  });

  it("counts a hub's figures for the chosen month only", () => {
    const stats = computeHubStats(input(), OCT).get("h8")!;
    expect(stats).toMatchObject({
      label: "Hub 8 - Cape Coast", // same wording as the office cash monitoring page
      adminName: "Ps Ama",
      adminSignedIn: true,
      partners: 4,
      branches: 2,
      cashFiled: 1,
      givingMinor: 17000,
    });
    expect(computeHubStats(input(), "2026-09").get("h8")!.givingMinor).toBe(
      99900,
    );
  });

  it("lists a region's hubs in login order (hub number, then name)", () => {
    const stats = computeHubStats(input(), OCT);
    expect(
      hubsForRegion(input().hubs, stats, "UD_GHANA").map((h) => h.hubId),
    ).toEqual(["h2", "h8"]);
    expect(
      hubsForRegion(input().hubs, stats, "AFRICA").map((h) => h.hubId),
    ).toEqual(["hk"]);
  });

  it("reports each branch: pastor, people, giving and whether its cash report is in", () => {
    const report = buildHubReport(input(), OCT, "h8")!;
    expect(report.branches).toEqual([
      {
        churchId: "c-abura",
        name: "Abura",
        pastor: "",
        partners: 1,
        givingMinor: 5000,
        cashFiled: false,
        cashMinor: 0,
      },
      {
        churchId: "c-lion",
        name: "Lion of Judah",
        pastor: "Bishop Paschal",
        partners: 2,
        givingMinor: 10000,
        cashFiled: true,
        cashMinor: 45000,
      },
    ]);
    expect(report.noBranchGivingMinor).toBe(2000); // p4 gave but has no branch
  });

  it("returns nothing for a hub that does not exist", () => {
    expect(buildHubReport(input(), OCT, "missing")).toBeNull();
  });

  it("reads the month from the address, falling back to the current month", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    expect(resolveMonth("2026-09", now)).toBe("2026-09");
    expect(resolveMonth(["2026-08"], now)).toBe("2026-08");
    expect(resolveMonth("2026-13", now)).toBe("2026-10");
    expect(resolveMonth("anything", now)).toBe("2026-10");
    expect(resolveMonth(undefined, now)).toBe("2026-10");
  });
});
