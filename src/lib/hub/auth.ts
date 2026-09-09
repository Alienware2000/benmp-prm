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
  /** null in a region that identifies hubs by name (Decision 0020). */
  hub_number: number | null;
  /** "8 — Cape Coast", or "Kpandai". */
  hub_label: string;
  region_code: string;
};

export type HubLoginResult =
  { ok: true; account: HubAccountRecord } | { ok: false; error: string };

const BAD_CREDENTIALS =
  "That hub number and password combination is not correct.";

/**
 * Since Decision 0020 the admin picks their hub from a list rather than typing
 * it, so the wrong half of the pair is always the password. Naming the hub back
 * to them is safe — the picker just showed it — and stops "is it my hub or my
 * password?" support calls.
 */
const BAD_PASSWORD = "That password is not correct for this hub.";

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

/**
 * Login for the region-aware picker (Decision 0020): the form submits the hub's
 * id, chosen from a dropdown, so nothing depends on an admin spelling "Tamale
 * Aparche" or knowing they are hub 8. Works for both kinds of region — numbered
 * UD Ghana hubs and named UJ Ghana ones — because the id is the id either way.
 */
export async function loginHubById(
  hubId: string,
  password: string,
  findAccount: (hubId: string) => Promise<HubAccountRecord | null>,
): Promise<HubLoginResult> {
  const id = hubId.trim();
  if (id === "" || password === "") {
    return { ok: false, error: BAD_PASSWORD };
  }
  const account = await findAccount(id);
  if (!account || !verifyPassword(password, account.password_hash)) {
    return { ok: false, error: BAD_PASSWORD };
  }
  return { ok: true, account };
}

/**
 * Rules for a replacement password, region-agnostic. A named region has no
 * number to ban, so the banned value is whatever the initial password was.
 */
export function validateNewPassword(
  next: string,
  initial: string,
): string | null {
  if (next.length < 8) {
    return "The new password must be at least 8 characters long.";
  }
  if (next.trim() !== next) {
    return "The new password cannot start or end with a space.";
  }
  if (next.replace(/\s+/g, "") === initial) {
    return "The new password cannot be the one you were issued.";
  }
  return null;
}
