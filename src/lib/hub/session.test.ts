import { describe, expect, it } from "vitest";
import {
  createHubSessionToken,
  verifyHubSessionToken,
  HUB_SESSION_MAX_AGE_S,
} from "./session";

const base = {
  accountId: "acc-1",
  hubId: "hub-1",
  regionCode: "UD_GHANA",
  hubNumber: 7,
  hubLabel: "7 — East End",
  mustChange: true,
};

describe("hub session token", () => {
  it("round-trips a session", async () => {
    const token = await createHubSessionToken(base, "secret");
    const session = await verifyHubSessionToken(token, "secret");
    expect(session).toMatchObject(base);
  });

  it("rejects a tampered payload and a wrong secret", async () => {
    const token = await createHubSessionToken(base, "secret");
    const [payload, sig] = token.split(".");
    // flip the hub number inside the payload, keep the old signature
    const decoded = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString(),
    );
    decoded.hubNumber = 8;
    const forged =
      Buffer.from(JSON.stringify(decoded)).toString("base64url") + "." + sig;
    expect(await verifyHubSessionToken(forged, "secret")).toBeNull();
    expect(await verifyHubSessionToken(token, "other-secret")).toBeNull();
  });

  it("rejects an expired token but accepts a live one", async () => {
    const now = 1_000_000;
    const token = await createHubSessionToken(base, "s", now);
    expect(await verifyHubSessionToken(token, "s", now + 60)).not.toBeNull();
    expect(
      await verifyHubSessionToken(token, "s", now + HUB_SESSION_MAX_AGE_S + 1),
    ).toBeNull();
  });

  it("rejects garbage shapes", async () => {
    expect(await verifyHubSessionToken(undefined, "s")).toBeNull();
    expect(await verifyHubSessionToken("", "s")).toBeNull();
    expect(await verifyHubSessionToken("a.b.c", "s")).toBeNull();
    expect(await verifyHubSessionToken("not-a-token", "s")).toBeNull();
  });
});

describe("regions in the session (Decision 0020)", () => {
  const secret = "test-secret";

  it("round-trips a name-region session with no hub number", async () => {
    const token = await createHubSessionToken(
      {
        accountId: "a1",
        hubId: "h1",
        regionCode: "UJ_GHANA",
        hubNumber: null,
        hubLabel: "Kpandai",
        mustChange: false,
      },
      secret,
    );
    const s = await verifyHubSessionToken(token, secret);
    expect(s?.regionCode).toBe("UJ_GHANA");
    expect(s?.hubNumber).toBeNull();
    expect(s?.hubLabel).toBe("Kpandai");
  });

  it("reads a pre-regions token as UD Ghana instead of logging the hub out", async () => {
    // Exactly the payload shape shipped before migration 0010.
    const legacy = {
      accountId: "a1",
      hubId: "h1",
      hubNumber: 8,
      mustChange: false,
    };
    const payload = Buffer.from(
      JSON.stringify({ ...legacy, exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString("base64url");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = Buffer.from(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    ).toString("base64url");

    const s = await verifyHubSessionToken(`${payload}.${sig}`, secret);
    expect(s).not.toBeNull();
    expect(s?.regionCode).toBe("UD_GHANA");
    expect(s?.hubNumber).toBe(8);
    expect(s?.hubLabel).toBe("Hub 8");
  });

  it("still rejects a token with neither a hub number nor a label", async () => {
    const payload = Buffer.from(
      JSON.stringify({
        accountId: "a1",
        hubId: "h1",
        mustChange: false,
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString("base64url");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = Buffer.from(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    ).toString("base64url");
    expect(await verifyHubSessionToken(`${payload}.${sig}`, secret)).toBeNull();
  });
});
