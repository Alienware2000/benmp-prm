import { describe, expect, it } from "vitest";
import { parseGivenUsd, parseReportingMonth, validateMemberMarks, validateSummaryCounts } from "./validation";

describe("parseReportingMonth", () => {
  it("parses a valid YYYY-MM string to the first of the month", () => {
    expect(parseReportingMonth("2026-10")).toBe("2026-10-01");
  });
  it("rejects empty or malformed strings", () => {
    expect(parseReportingMonth("")).toBeNull();
    expect(parseReportingMonth("2026")).toBeNull();
    expect(parseReportingMonth("2026-13")).toBeNull();
    expect(parseReportingMonth("garbage")).toBeNull();
  });
  it("rejects future months", () => {
    const now = new Date();
    const futureYear = now.getFullYear() + 1;
    expect(parseReportingMonth(`${futureYear}-01`)).toBeNull();
  });
});

describe("validateSummaryCounts", () => {
  const full = { totalRegistered: 120, activePartners: 80, newRegistrations: 5, lapsed: 3 };
  it("accepts four whole numbers, zero included", () => {
    expect(validateSummaryCounts(full)).toEqual({ ok: true });
    expect(validateSummaryCounts({ ...full, lapsed: 0 })).toEqual({ ok: true });
  });
  it("requires every number: the summary is the compulsory part of the form", () => {
    expect(validateSummaryCounts({ ...full, activePartners: null })).toEqual({
      ok: false,
      error: 'Fill in "Active partners" in the monthly summary.',
    });
  });
  it("rejects negatives and fractions", () => {
    expect(validateSummaryCounts({ ...full, lapsed: -1 }).ok).toBe(false);
    expect(validateSummaryCounts({ ...full, newRegistrations: 2.5 }).ok).toBe(false);
  });
});

describe("parseGivenUsd", () => {
  it("reads dollars as cents, zero included", () => {
    expect(parseGivenUsd("0")).toEqual({ ok: true, cents: 0 });
    expect(parseGivenUsd(" $1,250.5 ")).toEqual({ ok: true, cents: 125050 });
    expect(parseGivenUsd("300")).toEqual({ ok: true, cents: 30000 });
  });
  it("is required, and must be a plain amount", () => {
    expect(parseGivenUsd("").ok).toBe(false);
    expect(parseGivenUsd("-5").ok).toBe(false);
    expect(parseGivenUsd("12.345").ok).toBe(false);
    expect(parseGivenUsd("GHS 40").ok).toBe(false);
  });
});

describe("validateMemberMarks", () => {
  const members = ["p1", "p2", "p3"];
  const mark = (partnerId: string, status: string) => ({ partnerId, status });

  it("accepts one mark per member", () => {
    const r = validateMemberMarks([mark("p1", "active"), mark("p2", "lapsed"), mark("p3", "remove")], members);
    expect(r.ok && [...r.marks]).toEqual([["p1", "active"], ["p2", "lapsed"], ["p3", "remove"]]);
  });

  it("requires every member to be marked, and says how many are left", () => {
    const r = validateMemberMarks([mark("p1", "active")], members);
    expect(r).toEqual({ ok: false, error: "Mark every member: 2 are not marked yet.", unmarked: ["p2", "p3"] });
  });

  it("rejects someone not on the church's list, an unknown mark, or a member marked twice", () => {
    expect(validateMemberMarks([mark("px", "active")], members).ok).toBe(false);
    expect(validateMemberMarks([mark("p1", "gone")], members).ok).toBe(false);
    expect(validateMemberMarks([mark("p1", "active"), mark("p1", "new")], members).ok).toBe(false);
  });

  it("accepts a church with no members yet", () => {
    expect(validateMemberMarks([], []).ok).toBe(true);
  });
});
