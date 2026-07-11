import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/proxy";

export const dynamic = "force-dynamic";

/** Verify the shared password and set the session cookie. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  const expected = process.env.POC_PASSWORD;

  // If no password is configured the gate is open; treat any login as success.
  if (expected && password !== expected) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  if (expected) {
    res.cookies.set(SESSION_COOKIE, await sessionToken(expected), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
  return res;
}
