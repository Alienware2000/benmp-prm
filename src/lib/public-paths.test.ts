import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("lets the login flow through", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/login")).toBe(true);
  });

  it("lets the login picker load its own dropdowns", () => {
    // Regression: without this the middleware 307s the fetch to /poc and the
    // form shows "Could not load the region list".
    expect(isPublicPath("/api/regions")).toBe(true);
  });

  it("lets a branch fill in the cash form without logging in", () => {
    for (const p of ["/cash", "/api/cash/preview", "/api/cash/template", "/api/cash/submit"]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("keeps everything else closed", () => {
    for (const p of [
      "/",
      "/poc",
      "/hub",
      "/api/hub/ingest/submit",
      "/api/poc/send",
      "/partners",
      "/api/regions/secret",
      "/api/regionsfoo",
      "/login/extra",
      "/api/poc/cash/submissions",
    ]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });
});
