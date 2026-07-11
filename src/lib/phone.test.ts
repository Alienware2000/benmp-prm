import { describe, it, expect } from "vitest";
import { normalizePhone, samePhone } from "./phone";

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
