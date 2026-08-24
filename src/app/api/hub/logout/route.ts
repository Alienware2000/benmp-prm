import { NextResponse } from "next/server";
import { HUB_SESSION_COOKIE } from "@/lib/hub/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HUB_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
