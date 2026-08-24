import { describe, expect, it } from "vitest";
import { loginHub, validateNewHubPassword, type HubAccountRecord } from "./auth";
import { hashPassword } from "./password";

const account = (over: Partial<HubAccountRecord> = {}): HubAccountRecord => ({
  id: "acc-7",
  hub_id: "hub-7",
  username: "7",
  password_hash: hashPassword("7"),
  must_change_password: true,
  hub_number: 7,
  ...over,
});

describe("loginHub", () => {
  const store = (rec: HubAccountRecord | null) => async (username: string) =>
    rec && rec.username === username ? rec : null;

  it("logs in with the hub number and initial password, tolerating a leading zero", async () => {
    const rec = account();
    expect((await loginHub("7", "7", store(rec))).ok).toBe(true);
    expect((await loginHub(" 07 ", "7", store(rec))).ok).toBe(true);
  });

  it("gives one indistinguishable failure for unknown hub and wrong password", async () => {
    const rec = account();
    const unknown = await loginHub("31", "7", store(rec));
    const wrongPw = await loginHub("7", "nope", store(rec));
    expect(unknown.ok).toBe(false);
    expect(wrongPw.ok).toBe(false);
    expect(unknown).toEqual(wrongPw);
  });

  it("rejects non-numeric usernames and empty passwords without hitting the store", async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return null;
    };
    expect((await loginHub("seven", "7", spy)).ok).toBe(false);
    expect((await loginHub("7; drop", "7", spy)).ok).toBe(false);
    expect((await loginHub("7", "", spy)).ok).toBe(false);
    expect(called).toBe(false);
  });
});

describe("validateNewHubPassword", () => {
  it("enforces length, trimming, and not-the-hub-number", () => {
    expect(validateNewHubPassword("short", 7)).toMatch(/8 characters/);
    expect(validateNewHubPassword(" padded-pw ", 7)).toMatch(/space/);
    expect(validateNewHubPassword("7", 7)).toMatch(/8 characters/);
    expect(validateNewHubPassword("77777777", 7)).toBeNull(); // long, not the hub number
    expect(validateNewHubPassword("a good password", 7)).toBeNull();
  });

  it("blocks the hub number even disguised with spaces (once long enough)", () => {
    expect(validateNewHubPassword("3 1 3 1 3 1 3 1", 31313131)).toMatch(/hub number/);
  });
});
