import { describe, expect, it } from "vitest";
import { decideHubRoute } from "./gate";
import type { HubSession } from "./session";

const session = (mustChange: boolean): HubSession => ({
  accountId: "a",
  hubId: "h",
  hubNumber: 7,
  mustChange,
  exp: Math.floor(Date.now() / 1000) + 3600,
});

describe("decideHubRoute", () => {
  it("without a hub session: hub pages go to login, hub APIs 401, other paths fall through to staff rules", () => {
    expect(decideHubRoute("/hub", null)).toEqual({ kind: "redirect", to: "/login" });
    expect(decideHubRoute("/hub/password", null)).toEqual({ kind: "redirect", to: "/login" });
    expect(decideHubRoute("/api/hub/password", null)).toEqual({ kind: "unauthorized" });
    expect(decideHubRoute("/poc", null)).toEqual({ kind: "not-hub" });
    expect(decideHubRoute("/", null)).toEqual({ kind: "not-hub" });
  });

  it("a hub session is corralled into the hub area — it never reaches /poc or staff APIs", () => {
    expect(decideHubRoute("/poc", session(false))).toEqual({ kind: "redirect", to: "/hub" });
    expect(decideHubRoute("/api/poc/send", session(false))).toEqual({ kind: "redirect", to: "/hub" });
    expect(decideHubRoute("/", session(false))).toEqual({ kind: "redirect", to: "/hub" });
    expect(decideHubRoute("/hub", session(false))).toEqual({ kind: "next" });
  });

  it("must-change sessions are forced to the password screen and can reach nothing else in the hub area", () => {
    expect(decideHubRoute("/hub", session(true))).toEqual({ kind: "redirect", to: "/hub/password" });
    expect(decideHubRoute("/hub/password", session(true))).toEqual({ kind: "next" });
    expect(decideHubRoute("/api/hub/password", session(true))).toEqual({ kind: "next" });
    expect(decideHubRoute("/api/hub/logout", session(true))).toEqual({ kind: "next" });
    expect(decideHubRoute("/api/hub/ingest", session(true))).toEqual({ kind: "unauthorized" });
  });

  it("a hub lookalike prefix is not the hub area", () => {
    expect(decideHubRoute("/hubris", null)).toEqual({ kind: "not-hub" });
  });
});
