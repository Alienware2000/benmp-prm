import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  normalizePhoneForCallingCode,
  samePhone,
} from "./phone";

describe("normalizePhone (Ghana-first)", () => {
  it("normalizes the leading-zero national form", () => {
    expect(normalizePhone("0244123456")).toBe("+233244123456");
  });

  it("keeps an already-international number", () => {
    expect(normalizePhone("+233 24 412 3456")).toBe("+233244123456");
  });

  it("adds the + to a country-code number without one", () => {
    expect(normalizePhone("233244123456")).toBe("+233244123456");
  });

  it("expands a bare 9-digit national significant number", () => {
    expect(normalizePhone("244123456")).toBe("+233244123456");
  });

  it("strips spaces, dashes and parentheses", () => {
    expect(normalizePhone("024-412 3456")).toBe("+233244123456");
  });

  it("returns null for empty or unusable input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("samePhone", () => {
  it("matches across formats", () => {
    expect(samePhone("0244123456", "+233 244 123 456")).toBe(true);
  });

  it("does not match different numbers", () => {
    expect(samePhone("0244123456", "0201112222")).toBe(false);
  });

  it("is false when either side is unusable", () => {
    expect(samePhone("0244123456", null)).toBe(false);
    expect(samePhone("junk", "junk")).toBe(false);
  });
});

describe("normalizePhoneForCallingCode", () => {
  it("accepts the calling code already present, no leading +", () => {
    expect(normalizePhoneForCallingCode("26772973310", "267", [8])).toBe(
      "+26772973310",
    );
  });

  it("prepends the calling code to a bare national number", () => {
    expect(normalizePhoneForCallingCode("74889395", "267", [8])).toBe(
      "+26774889395",
    );
  });

  it("drops a national trunk-prefix 0 and prepends the calling code", () => {
    expect(normalizePhoneForCallingCode("07908526045", "44", [10])).toBe(
      "+447908526045",
    );
  });

  it("keeps an explicit + regardless of the given calling code", () => {
    expect(normalizePhoneForCallingCode("+233 26 060 1010", "225", [8])).toBe(
      "+233260601010",
    );
  });

  it("strips spaces and punctuation before matching", () => {
    expect(normalizePhoneForCallingCode("267 76 624 395", "267", [8])).toBe(
      "+26776624395",
    );
  });

  it("accepts any NSN length in the allowed set", () => {
    expect(normalizePhoneForCallingCode("24162182610", "241", [7, 8])).toBe(
      "+24162182610",
    );
    expect(normalizePhoneForCallingCode("6200326", "241", [7, 8])).toBe(
      "+2416200326",
    );
  });

  it("rejects a digit count that matches no recognized shape rather than guessing", () => {
    expect(
      normalizePhoneForCallingCode("12683017872611", "1", [10]),
    ).toBeNull();
    expect(normalizePhoneForCallingCode("N/A", "267", [8])).toBeNull();
    expect(normalizePhoneForCallingCode("", "267", [8])).toBeNull();
    expect(normalizePhoneForCallingCode(null, "267", [8])).toBeNull();
  });
});
