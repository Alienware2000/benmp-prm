import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Password gate for the POC console.
 *
 * `/poc` and `/api/poc/*` show real partner data (names, phones, giving), so they must
 * not be public once deployed. This gate requires HTTP Basic Auth against POC_PASSWORD
 * (and optional POC_USER, default "benmp").
 *
 * If POC_PASSWORD is unset, requests pass through — convenient for local dev. ALWAYS set
 * POC_PASSWORD in any deployed environment (see docs/deployment.md).
 */

const USER = process.env.POC_USER ?? "benmp";

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="BENMP PRM", charset="UTF-8"' },
  });
}

export function proxy(request: NextRequest) {
  const password = process.env.POC_PASSWORD;
  if (!password) return NextResponse.next(); // not configured → open (local dev only)

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [user, pass] = atob(header.slice(6)).split(":");
      if (user === USER && pass === password) return NextResponse.next();
    } catch {
      // malformed header → fall through to 401
    }
  }
  return unauthorized();
}

export const config = {
  matcher: ["/poc", "/poc/:path*", "/api/poc/:path*"],
};
