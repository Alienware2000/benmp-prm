import { NextRequest, NextResponse } from "next/server";
import { validateNewHubPassword } from "@/lib/hub/auth";
import { hashPassword, verifyPassword } from "@/lib/hub/password";
import { findHubAccountById, updateHubPassword } from "@/lib/hub/db";
import {
  createHubSessionToken,
  hubSessionSecret,
  HUB_SESSION_COOKIE,
  HUB_SESSION_MAX_AGE_S,
  verifyHubSessionToken,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

/**
 * Replace the hub account's password. Requires a valid hub session (the proxy
 * also enforces this; verified again here because the session names the account
 * being changed). The current password is re-checked against the database, not
 * the cookie, so a stolen cookie alone cannot rotate the password.
 */
export async function POST(req: NextRequest) {
  const session = await verifyHubSessionToken(
    req.cookies.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";

  const account = await findHubAccountById(session.accountId);
  if (!account || !verifyPassword(current, account.password_hash)) {
    return NextResponse.json(
      { ok: false, error: "The current password is not correct." },
      { status: 401 },
    );
  }

  const problem = validateNewHubPassword(next, account.hub_number);
  if (problem) {
    return NextResponse.json({ ok: false, error: problem }, { status: 400 });
  }

  await updateHubPassword(account.id, hashPassword(next));

  const token = await createHubSessionToken(
    {
      accountId: account.id,
      hubId: account.hub_id,
      hubNumber: account.hub_number,
      mustChange: false,
    },
    hubSessionSecret(),
  );
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HUB_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HUB_SESSION_MAX_AGE_S,
  });
  return res;
}
