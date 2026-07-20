import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * App-wide gate.
 *
 * Two jobs:
 *  1. The pre-POC MVP shell (/, /partners, /giving, ...) must not show AT ALL — it runs on
 *     mock demo data and would read as fake numbers to a visitor. Everything that isn't the
 *     POC console or the login flow redirects to /poc, for everyone, signed in or not. The
 *     old routes stay in the codebase as the post-POC MVP foundation; they are just
 *     unroutable until that work resumes.
 *  2. Password gate for the POC console — a proper in-app login (not the browser's
 *     Basic-auth popup). `/poc` and `/api/poc/*` require a valid session cookie set by
 *     /api/login after the shared password (POC_PASSWORD) is entered on /login.
 *
 * If POC_PASSWORD is unset, the password check passes — convenient for local dev; the
 * old-page redirect still applies. ALWAYS set POC_PASSWORD in any deployed environment
 * (see docs/deployment.md).
 */

export const SESSION_COOKIE = "poc_session";

/** Cookie value = base64(sha256(password)); can't be forged without knowing the password. */
export async function sessionToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login flow is the only public surface.
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  // Everything that isn't the POC (the old mock MVP shell) collapses to the console.
  if (!pathname.startsWith("/poc") && !pathname.startsWith("/api/poc")) {
    const url = request.nextUrl.clone();
    url.pathname = "/poc";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const password = process.env.POC_PASSWORD;
  if (!password) return NextResponse.next(); // not configured → open (local dev only)

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && cookie === (await sessionToken(password))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and static files (paths containing a dot).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
