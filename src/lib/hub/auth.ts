/**
 * Hub login and password-change logic (HP-2). Pure over an injected account
 * store, in the repo's usual style, so the rules are unit-tested without a
 * database; the route handlers wire in PostgREST.
 *
 * Failure reasons are deliberately one office-language string ("check the hub
 * number and password") — the API never distinguishes "no such hub" from
 * "wrong password".
 */
import { verifyPassword } from "./password";

export type HubAccountRecord = {
  id: string;
  hub_id: string;
  username: string;
  password_hash: string;
  must_change_password: boolean;
  hub_number: number;
};

export type HubLoginResult =
  | { ok: true; account: HubAccountRecord }
  | { ok: false; error: string };

const BAD_CREDENTIALS =
  "That hub number and password combination is not correct.";

export async function loginHub(
  usernameRaw: string,
  password: string,
  findAccount: (username: string) => Promise<HubAccountRecord | null>,
): Promise<HubLoginResult> {
  const username = usernameRaw.trim();
  // Hub numbers are the only usernames (Decision 0018 item 1).
  if (!/^\d{1,4}$/.test(username) || password === "") {
    return { ok: false, error: BAD_CREDENTIALS };
  }
  const account = await findAccount(String(Number(username)));
  if (!account || !verifyPassword(password, account.password_hash)) {
    return { ok: false, error: BAD_CREDENTIALS };
  }
  return { ok: true, account };
}

/**
 * Rules for a replacement password. Returns an office-language problem, or
 * null when acceptable. The initial password is the hub number, so the new
 * one must at minimum not be that.
 */
export function validateNewHubPassword(
  next: string,
  hubNumber: number,
): string | null {
  if (next.length < 8) {
    return "The new password must be at least 8 characters long.";
  }
  if (next.trim() !== next) {
    return "The new password cannot start or end with a space.";
  }
  const digits = next.replace(/\s+/g, "");
  if (digits === String(hubNumber)) {
    return "The new password cannot be the hub number.";
  }
  return null;
}
