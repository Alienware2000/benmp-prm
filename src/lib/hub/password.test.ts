import { describe, expect, it } from "vitest";
import { hashPassword, initialHubPassword, verifyPassword } from "./password";

describe("hub password hashing", () => {
  it("round-trips a password and rejects the wrong one", () => {
    const stored = hashPassword("correct horse");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("correct horse", stored)).toBe(true);
    expect(verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("salts: hashing the same password twice stores different values", () => {
    expect(hashPassword("7")).not.toBe(hashPassword("7"));
  });

  it("rejects malformed stored values instead of throwing", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "plaintext")).toBe(false);
    expect(verifyPassword("x", "scrypt$nothex$nothex")).toBe(false);
    expect(verifyPassword("x", "bcrypt$aa$bb")).toBe(false);
  });

  it("initial password is the hub number (Decision 0018), forced to change on first login", () => {
    expect(initialHubPassword(7)).toBe("7");
    expect(verifyPassword("7", hashPassword(initialHubPassword(7)))).toBe(true);
  });
});
