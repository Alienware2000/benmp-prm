import { describe, expect, it } from "vitest";
import {
  UNATTRIBUTED,
  branchOptions,
  filterGiving,
  sortByDateDesc,
  summarizeGiving,
  toEntries,
  type DbGivingPayment,
  type GivingEntry,
} from "./giving";

const branchMap = new Map([
  ["+233240000001", { branch: "Qodesh", name: "Ama Serwaa" }],
  ["+233240000002", { branch: "Atonsu", name: "Kofi Mensah" }],
]);

const payments: DbGivingPayment[] = [
  { reference: "r1", payer_name: "Ama Serwaa", payer_phone_e164: "+233240000001", amount_minor: 10_000, currency: "GHS", paid_at: "2026-06-01T03:00:00+00:00" },
  { reference: "r2", payer_name: "Kofi Mensah", payer_phone_e164: "+233240000002", amount_minor: 5_000, currency: "GHS", paid_at: "2026-06-15T09:20:00+00:00" },
  { reference: "r3", payer_name: "Stranger", payer_phone_e164: "+233249999999", amount_minor: 2_500, currency: "GHS", paid_at: "2026-07-02T11:00:00+00:00" },
];

const entries = toEntries(payments, branchMap);

describe("toEntries", () => {
  it("resolves branch by phone match", () => {
    expect(entries[0].branch).toBe("Qodesh");
    expect(entries[1].branch).toBe("Atonsu");
    expect(entries[0].attributed).toBe(true);
  });

  it("buckets unmatched giving as unattributed rather than dropping it", () => {
    expect(entries[2].branch).toBe(UNATTRIBUTED);
    expect(entries[2].attributed).toBe(false);
  });

  it("derives a date-only key for range filtering", () => {
    expect(entries[0].paidOn).toBe("2026-06-01");
  });

  it("falls back to the matched partner name when the statement has none", () => {
    const [e] = toEntries(
      [{ reference: "x", payer_name: "  ", payer_phone_e164: "+233240000001", amount_minor: 100, currency: "GHS", paid_at: "" }],
      branchMap,
    );
    expect(e.name).toBe("Ama Serwaa");
  });
});

describe("filterGiving", () => {
  it("filters by inclusive date range", () => {
    const r = filterGiving(entries, { from: "2026-06-01", to: "2026-06-15" });
    expect(r.map((e) => e.reference)).toEqual(["r1", "r2"]);
  });

  it("filters by branch, including the unattributed bucket", () => {
    expect(filterGiving(entries, { branch: "Qodesh" }).map((e) => e.reference)).toEqual(["r1"]);
    expect(filterGiving(entries, { branch: UNATTRIBUTED }).map((e) => e.reference)).toEqual(["r3"]);
  });

  it("filters by name case-insensitively on a substring", () => {
    expect(filterGiving(entries, { name: "kofi" }).map((e) => e.reference)).toEqual(["r2"]);
  });

  it("composes filters with AND", () => {
    expect(filterGiving(entries, { branch: "Qodesh", name: "kofi" })).toEqual([]);
  });

  it("returns everything when no filters are set", () => {
    expect(filterGiving(entries, {})).toHaveLength(3);
  });

  it("excludes undated rows when a date bound is set", () => {
    const undated = toEntries(
      [{ reference: "u", payer_name: "No Date", payer_phone_e164: null, amount_minor: 1, currency: "GHS", paid_at: null }],
      branchMap,
    );
    expect(filterGiving(undated, { from: "2026-01-01" })).toEqual([]);
    expect(filterGiving(undated, {})).toHaveLength(1);
  });
});

describe("summarizeGiving", () => {
  it("totals the filtered set, not the whole ledger", () => {
    const all = summarizeGiving(entries);
    expect(all.totalMinor).toBe(17_500);
    expect(all.count).toBe(3);

    const filtered = summarizeGiving(filterGiving(entries, { branch: "Qodesh" }));
    expect(filtered.totalMinor).toBe(10_000);
    expect(filtered.count).toBe(1);
  });

  it("counts distinct givers", () => {
    const repeat = toEntries(
      [payments[0], { ...payments[0], reference: "r1b", amount_minor: 1_000 }],
      branchMap,
    );
    const s = summarizeGiving(repeat);
    expect(s.count).toBe(2);
    expect(s.givers).toBe(1);
    expect(s.totalMinor).toBe(11_000);
  });

  it("breaks down by branch, largest first", () => {
    expect(summarizeGiving(entries).byBranch[0]).toEqual({ branch: "Qodesh", amountMinor: 10_000, count: 1 });
  });

  it("is zeroed for an empty set", () => {
    const s = summarizeGiving([]);
    expect(s.totalMinor).toBe(0);
    expect(s.count).toBe(0);
    expect(s.byBranch).toEqual([]);
  });

  it("branch totals always reconcile to the overall total", () => {
    const s = summarizeGiving(entries);
    expect(s.byBranch.reduce((n, b) => n + b.amountMinor, 0)).toBe(s.totalMinor);
  });
});

describe("sortByDateDesc / branchOptions", () => {
  it("puts the newest gift first", () => {
    expect(sortByDateDesc(entries).map((e) => e.reference)).toEqual(["r3", "r2", "r1"]);
  });

  it("sorts branches alphabetically but keeps unattributed last", () => {
    expect(branchOptions(entries)).toEqual(["Atonsu", "Qodesh", UNATTRIBUTED]);
  });

  it("does not mutate the input", () => {
    const before = entries.map((e) => e.reference);
    sortByDateDesc(entries);
    expect(entries.map((e: GivingEntry) => e.reference)).toEqual(before);
  });
});

describe("statement rows (Decision 0008 §6)", () => {
  const withNoise = toEntries(
    [
      ...payments,
      { reference: "n1", payer_name: "Ecobank MobileApp", payer_phone_e164: null, amount_minor: 10_000, currency: "GHS", paid_at: "2026-07-03T10:00:00+00:00" },
      { reference: "n2", payer_name: "INTEROPERABILITY PULL OVA", payer_phone_e164: null, amount_minor: 5_000, currency: "GHS", paid_at: "2026-07-04T10:00:00+00:00" },
    ],
    branchMap,
  );

  it("flags bank/interop artifacts as not-a-person", () => {
    expect(withNoise.find((e) => e.reference === "n1")?.isStatement).toBe(true);
    expect(withNoise.find((e) => e.reference === "r1")?.isStatement).toBe(false);
  });

  it("keeps their money in the total — it is real giving", () => {
    expect(summarizeGiving(withNoise).totalMinor).toBe(17_500 + 15_000);
  });

  it("does not count them as givers", () => {
    // 3 real people + 2 bank rows -> still 3 givers.
    expect(summarizeGiving(withNoise).givers).toBe(3);
    expect(summarizeGiving(withNoise).statementCount).toBe(2);
    expect(summarizeGiving(withNoise).statementMinor).toBe(15_000);
  });
});
