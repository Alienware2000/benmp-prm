/**
 * Routing decisions for hub sessions (HP-2), kept pure so the middleware's
 * behavior is unit-testable. The proxy translates a decision into a
 * redirect/401/next; this module only decides.
 */
import type { HubSession } from "./session";

export type HubRouteDecision =
  | { kind: "next" }
  | { kind: "redirect"; to: string }
  | { kind: "unauthorized" } // API caller without a valid session
  | { kind: "not-hub" }; // path is outside the hub area and no hub session — staff rules apply

const PASSWORD_PATHS = new Set([
  "/hub/password",
  "/api/hub/password",
  "/api/hub/logout",
]);

export function isHubPath(pathname: string): boolean {
  return (
    pathname === "/hub" ||
    pathname.startsWith("/hub/") ||
    pathname === "/api/hub" ||
    pathname.startsWith("/api/hub/")
  );
}

export function decideHubRoute(
  pathname: string,
  session: HubSession | null,
): HubRouteDecision {
  const inHubArea = isHubPath(pathname);

  if (!session) {
    if (!inHubArea) return { kind: "not-hub" };
    if (pathname.startsWith("/api/")) return { kind: "unauthorized" };
    return { kind: "redirect", to: "/login" };
  }

  // A hub session is corralled into the hub area: it never reaches /poc or the
  // staff APIs, and any stray path lands on the hub home.
  if (!inHubArea) return { kind: "redirect", to: "/hub" };

  // Initial password must be replaced before anything else works.
  if (session.mustChange && !PASSWORD_PATHS.has(pathname)) {
    if (pathname.startsWith("/api/")) return { kind: "unauthorized" };
    return { kind: "redirect", to: "/hub/password" };
  }

  return { kind: "next" };
}
