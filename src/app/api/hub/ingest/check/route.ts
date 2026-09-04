import { NextRequest, NextResponse } from "next/server";
import { findExistingPhones } from "@/lib/hub/db";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

/**
 * Which of these E.164 numbers are already partners (HP-3 preview). The same
 * lookup runs again inside submit — this endpoint only lets the preview show
 * "already in the system for Hub N" before the admin presses save.
 */
export async function POST(req: NextRequest) {
  const session = await verifyHubSessionToken(
    req.cookies.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { phones?: unknown };
  const phones = Array.isArray(body.phones)
    ? body.phones.filter((p): p is string => typeof p === "string").slice(0, 10_000)
    : [];

  const existing = await findExistingPhones(phones);
  // Only this hub's own partner/hub ids go to the browser. For a number owned by
  // another hub the preview needs nothing but the hub number it already shows.
  const safe = Object.fromEntries(
    [...existing].map(([phone, info]) => [
      phone,
      info.hubId === session.hubId
        ? info
        : { hubNumber: info.hubNumber },
    ]),
  );
  return NextResponse.json({ ok: true, existing: safe });
}
