import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Password gate for the POC console — a proper in-app login (not the browser's Basic-auth
 * popup). `/poc` and `/api/poc/*` require a valid session cookie set by /api/login after
 * the shared password (POC_PASSWORD) is entered on /login.
 *
 * If POC_PASSWORD is unset, requests pass through — convenient for local dev. ALWAYS set
 * POC_PASSWORD in any deployed environment (see docs/deployment.md).
 */

export const SESSION_COOKIE = "poc_session";

/** Cookie value = base64(sha256(password)); can't be forged without knowing the password. */
export async function sessionToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

export async function proxy(request: NextRequest) {
  const password = process.env.POC_PASSWORD;
  if (!password) return NextResponse.next(); // not configured → open (local dev only)

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && cookie === (await sessionToken(password))) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/poc", "/poc/:path*", "/api/poc/:path*"],
};
