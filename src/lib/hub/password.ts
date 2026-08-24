/**
 * Hub account password hashing (HP-2 dependency, created in HP-1 for the seed).
 *
 * scrypt from node:crypto — no external dependency, memory-hard, and fine at this
 * scale (31 accounts, occasional logins). Stored format: `scrypt$<salt hex>$<hash hex>`
 * with the library-default parameters (N=16384, r=8, p=1); a future parameter bump
 * gets a new prefix rather than reinterpreting old hashes.
 *
 * The initial password for a hub account is the hub number itself (Decision 0018) —
 * `must_change_password` forces a real one on first login.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  if (!/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]+$/.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function initialHubPassword(hubNumber: number): string {
  return String(hubNumber);
}
