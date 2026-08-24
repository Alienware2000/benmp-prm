import { describe, expect, it } from "vitest";
import {
  createHubSessionToken,
  verifyHubSessionToken,
  HUB_SESSION_MAX_AGE_S,
} from "./session";

const base = {
  accountId: "acc-1",
  hubId: "hub-1",
  hubNumber: 7,
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
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
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
