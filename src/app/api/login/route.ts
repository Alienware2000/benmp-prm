import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/proxy";
import { loginHub, loginHubById } from "@/lib/hub/auth";
import {
  findHubAccountByHubId,
  findHubAccountByUsername,
  touchHubLastLogin,
} from "@/lib/hub/db";
import {
  createHubSessionToken,
  hubSessionSecret,
  HUB_SESSION_COOKIE,
  HUB_SESSION_MAX_AGE_S,
} from "@/lib/hub/session";

export const dynamic = "force-dynamic";

/**
 * One login door, two kinds of user (Decision 0018 item 3):
 *  - staff: `{ password }` against the shared POC_PASSWORD → staff cookie
 *  - hub leader: `{ hubNumber, password }` against hub_accounts → hub cookie
 * The cookies are distinct; neither grants the other's access.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    password?: unknown;
    hubNumber?: unknown;
    hubId?: unknown;
  };
  const password = typeof body.password === "string" ? body.password : "";

  // Two hub doors. `hubId` is the picker (Decision 0020) and works for every
  // region; `hubNumber` is the pre-regions UD Ghana form, kept working so a
  // cached page or a bookmarked script does not break on deploy day.
  if (body.hubId !== undefined || body.hubNumber !== undefined) {
    const result =
      body.hubId !== undefined
        ? await loginHubById(
            typeof body.hubId === "string" ? body.hubId : "",
            password,
            findHubAccountByHubId,
          )
        : await loginHub(
            typeof body.hubNumber === "string" ? body.hubNumber : "",
            password,
            findHubAccountByUsername,
          );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 401 },
      );
    }
    const { account } = result;
    await touchHubLastLogin(account.id);
    const token = await createHubSessionToken(
      {
        accountId: account.id,
        hubId: account.hub_id,
        regionCode: account.region_code,
        hubNumber: account.hub_number,
        hubLabel: account.hub_label,
        mustChange: account.must_change_password,
      },
      hubSessionSecret(),
    );
    const res = NextResponse.json({
      ok: true,
      mustChange: account.must_change_password,
    });
    res.cookies.set(HUB_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: HUB_SESSION_MAX_AGE_S,
    });
    return res;
  }

  const expected = process.env.POC_PASSWORD;

  // If no password is configured the gate is open; treat any login as success.
  if (expected && password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Incorrect password." },
      { status: 401 },
    );
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
