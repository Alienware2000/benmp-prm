/**
 * Hub session cookie (HP-2, Decision 0018 item 3).
 *
 * Stateless signed token so the middleware can gate /hub/* without a database
 * round-trip: `base64url(payload).base64url(hmac-sha256(payload, secret))`.
 * Web Crypto only — this must run in the middleware runtime as well as Node.
 *
 * Distinct from the staff cookie (`poc_session`): a hub leader is not staff and
 * never inherits staff access, and vice versa.
 *
 * Secret: HUB_SESSION_SECRET, falling back to POC_PASSWORD so a deployed
 * environment is signed even before the dedicated secret is configured. With
 * neither set (bare local dev — deployed envs always have POC_PASSWORD) a
 * fixed dev placeholder is used, because WebCrypto refuses a zero-length HMAC
 * key; consistent with the POC gate being open when unconfigured.
 */

export const HUB_SESSION_COOKIE = "hub_session";
export const HUB_SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days, matching staff

export type HubSession = {
  /** hub_accounts.id */
  accountId: string;
  /** hubs.id */
  hubId: string;
  hubNumber: number;
  mustChange: boolean;
  /** unix seconds */
  exp: number;
};

export function hubSessionSecret(): string {
  return (
    process.env.HUB_SESSION_SECRET ||
    process.env.POC_PASSWORD ||
    "dev-only-unconfigured-secret"
  );
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(payloadB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  return b64url(new Uint8Array(sig));
}

export async function createHubSessionToken(
  session: Omit<HubSession, "exp">,
  secret: string,
  nowS = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: HubSession = { ...session, exp: nowS + HUB_SESSION_MAX_AGE_S };
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${payloadB64}.${await hmac(payloadB64, secret)}`;
}

/** Null on any problem: malformed, bad signature, expired, wrong shape. */
export async function verifyHubSessionToken(
  token: string | undefined,
  secret: string,
  nowS = Math.floor(Date.now() / 1000),
): Promise<HubSession | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if ((await hmac(payloadB64, secret)) !== sig) return null;
  const bytes = fromB64url(payloadB64);
  if (!bytes) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  const s = payload as Partial<HubSession>;
  if (
    typeof s.accountId !== "string" ||
    typeof s.hubId !== "string" ||
    typeof s.hubNumber !== "number" ||
    typeof s.mustChange !== "boolean" ||
    typeof s.exp !== "number"
  ) {
    return null;
  }
  if (s.exp <= nowS) return null;
  return s as HubSession;
}
