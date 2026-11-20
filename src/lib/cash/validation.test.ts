import { describe, expect, it } from "vitest";
import { parseGivingTotal, parseReportingMonth, validateSummaryCounts } from "./validation";

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

describe("parseGivingTotal", () => {
  it("reads blank as none and an amount as pesewas", () => {
    expect(parseGivingTotal("")).toEqual({ ok: true, minor: 0 });
    expect(parseGivingTotal(" 1,250.5 ")).toEqual({ ok: true, minor: 125050 });
    expect(parseGivingTotal("300")).toEqual({ ok: true, minor: 30000 });
  });
  it("rejects anything that is not a plain amount", () => {
    expect(parseGivingTotal("-5").ok).toBe(false);
    expect(parseGivingTotal("12.345").ok).toBe(false);
    expect(parseGivingTotal("GHS 40").ok).toBe(false);
  });
});
