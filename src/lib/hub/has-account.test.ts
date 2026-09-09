import { describe, expect, it } from "vitest";
import { hasAccount } from "./db";

describe("hasAccount (embedded hub_accounts)", () => {
  it("reads the one-to-one OBJECT shape PostgREST actually returns", () => {
    // hub_accounts.hub_id is `unique`, so the relationship is one-to-one and the
    // embed is an object. Treating it as an array emptied every login dropdown.
    expect(hasAccount({ id: "acc-1" })).toBe(true);
  });

  it("still reads the array shape, in case the relationship is seen as one-to-many", () => {
    expect(hasAccount([{ id: "acc-1" }])).toBe(true);
    expect(hasAccount([])).toBe(false);
  });

  it("treats a hub with no account as having none", () => {
    expect(hasAccount(null)).toBe(false);
    expect(hasAccount(undefined)).toBe(false);
  });
});
