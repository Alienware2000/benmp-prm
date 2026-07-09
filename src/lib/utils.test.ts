import { describe, expect, it } from "vitest";
import { compactNumber, currency, minorCurrency } from "@/lib/utils";

// First real test — proves the per-task green gate works against existing code.
// (Harness smoke test; superseded by richer suites as phases land.)
describe("currency formatting", () => {
  it("formats whole-unit USD with no decimals", () => {
    expect(currency(1500)).toBe("$1,500");
  });

  it("respects a non-USD currency code", () => {
    expect(currency(1000, "GHS")).toContain("1,000");
  });

  it("converts minor units (cents) to major units", () => {
    expect(minorCurrency(150_00)).toBe("$150");
  });

  it("renders large counts compactly", () => {
    expect(compactNumber(40_000)).toBe("40K");
  });
});
