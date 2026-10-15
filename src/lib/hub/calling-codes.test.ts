import { describe, expect, it } from "vitest";
import { callingCodeForCountry } from "./calling-codes";

describe("callingCodeForCountry", () => {
  it("maps every seeded hub country", () => {
    expect(callingCodeForCountry("Malawi")).toBe("265");
    expect(callingCodeForCountry("Seychelles")).toBe("248");
    expect(callingCodeForCountry("South Africa")).toBe("27");
    expect(callingCodeForCountry("Ghana")).toBe("233");
    expect(callingCodeForCountry("Tanzania")).toBe("255");
    expect(callingCodeForCountry("Burundi")).toBe("257");
  });

  it("takes the first country of a combined hub, and null for unknown or mixed", () => {
    expect(callingCodeForCountry("Uganda & South Sudan")).toBe("256");
    expect(callingCodeForCountry("Europe")).toBeNull();
    expect(callingCodeForCountry("Asia")).toBeNull();
    expect(callingCodeForCountry("Middle East")).toBeNull();
    expect(callingCodeForCountry(null)).toBeNull();
  });

  it("knows the ESCHATOS single-country hubs (Decision 0034)", () => {
    expect(callingCodeForCountry("Brazil")).toBe("55");
    expect(callingCodeForCountry("Jamaica")).toBe("1876");
  });
});
