/**
 * PostgREST access for hub auth (HP-2). Server-only — uses the service role,
 * mirroring src/lib/poc/db.ts. RLS has no anon policies on the hub tables, so
 * everything goes through these helpers.
 */
import type { HubAccountRecord } from "./auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(): Record<string, string> {
  if (!SUPABASE_URL || !KEY) {
    throw new Error("Supabase is not configured (URL / service role key missing)");
  }
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

type AccountRow = {
  id: string;
  hub_id: string;
  username: string;
  password_hash: string;
  must_change_password: boolean;
  hubs: { hub_number: number } | null;
};

export async function findHubAccountByUsername(
  username: string,
): Promise<HubAccountRecord | null> {
  const rows = await rest<AccountRow[]>(
    `hub_accounts?username=eq.${encodeURIComponent(username)}` +
      `&select=id,hub_id,username,password_hash,must_change_password,hubs(hub_number)`,
  );
  const row = rows?.[0];
  if (!row || !row.hubs) return null;
  return {
    id: row.id,
    hub_id: row.hub_id,
    username: row.username,
    password_hash: row.password_hash,
    must_change_password: row.must_change_password,
    hub_number: row.hubs.hub_number,
  };
}

export async function findHubAccountById(
  accountId: string,
): Promise<HubAccountRecord | null> {
  const rows = await rest<AccountRow[]>(
    `hub_accounts?id=eq.${encodeURIComponent(accountId)}` +
      `&select=id,hub_id,username,password_hash,must_change_password,hubs(hub_number)`,
  );
  const row = rows?.[0];
  if (!row || !row.hubs) return null;
  return {
    id: row.id,
    hub_id: row.hub_id,
    username: row.username,
    password_hash: row.password_hash,
    must_change_password: row.must_change_password,
    hub_number: row.hubs.hub_number,
  };
}

export async function touchHubLastLogin(accountId: string): Promise<void> {
  await rest(`hub_accounts?id=eq.${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_login_at: new Date().toISOString() }),
  });
}

/** Sets the new hash and clears must_change_password in one write. */
export async function updateHubPassword(
  accountId: string,
  passwordHash: string,
): Promise<void> {
  await rest(`hub_accounts?id=eq.${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      password_hash: passwordHash,
      must_change_password: false,
    }),
  });
}

export type HubSummary = {
  hubNumber: number;
  leaderName: string;
  churchCount: number;
  partnerCount: number;
};

export async function getHubSummary(hubId: string): Promise<HubSummary | null> {
  const id = encodeURIComponent(hubId);
  const hubs = await rest<{ hub_number: number; leader_name: string }[]>(
    `hubs?id=eq.${id}&select=hub_number,leader_name`,
  );
  const hub = hubs?.[0];
  if (!hub) return null;

  const count = async (path: string): Promise<number> => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "HEAD",
      headers: { ...headers(), Prefer: "count=exact" },
      cache: "no-store",
    });
    const range = res.headers.get("content-range"); // e.g. "0-24/807"
    const total = range?.split("/")[1];
    return total && total !== "*" ? Number(total) : 0;
  };

  const [churchCount, partnerCount] = await Promise.all([
    count(`hub_churches?hub_id=eq.${id}&select=id`),
    count(`partners?hub_id=eq.${id}&select=id`),
  ]);
  return {
    hubNumber: hub.hub_number,
    leaderName: hub.leader_name,
    churchCount,
    partnerCount,
  };
}
