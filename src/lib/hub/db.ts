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

// ---------------------------------------------------------------------------
// Ingestion (HP-3)
// ---------------------------------------------------------------------------

export type HubChurchRow = { id: string; name: string; name_key: string };

export async function getHubChurches(hubId: string): Promise<HubChurchRow[]> {
  return await rest<HubChurchRow[]>(
    `hub_churches?hub_id=eq.${encodeURIComponent(hubId)}&select=id,name,name_key&order=name.asc`,
  );
}

/**
 * Which of these E.164 phones already belong to a partner, and to which hub.
 * Chunked so the querystring stays sane on big uploads. A partner without a
 * hub (pre-hub data) comes back with hubNumber null.
 */
export async function findExistingPhones(
  phones: string[],
): Promise<Map<string, { hubNumber: number | null }>> {
  const out = new Map<string, { hubNumber: number | null }>();
  const unique = [...new Set(phones)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const list = chunk.map((p) => `"${p}"`).join(",");
    const rows = await rest<
      { whatsapp_number: string; hubs: { hub_number: number } | null }[]
    >(
      `partners?whatsapp_number=in.(${encodeURIComponent(list)})` +
        `&select=whatsapp_number,hubs(hub_number)`,
    );
    for (const r of rows) {
      out.set(r.whatsapp_number, { hubNumber: r.hubs?.hub_number ?? null });
    }
  }
  return out;
}

export type IngestBatchInput = {
  hubId: string;
  fileName: string;
  sheetName: string;
  columnMap: unknown;
  rowCount: number;
};

export async function createIngestBatch(
  input: IngestBatchInput,
): Promise<string> {
  const rows = await rest<{ id: string }[]>(`hub_ingest_batches`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      hub_id: input.hubId,
      file_name: input.fileName,
      sheet_name: input.sheetName,
      column_map: input.columnMap,
      row_count: input.rowCount,
      status: "draft",
    }),
  });
  return rows[0].id;
}

export type IngestRowInsert = {
  batch_id: string;
  row_index: number;
  raw: unknown;
  name: string | null;
  phone_e164: string | null;
  church_id: string | null;
  status: "accepted" | "removed";
  issues: unknown;
};

export async function insertIngestRows(rows: IngestRowInsert[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    await rest(`hub_ingest_rows`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
  }
}

export type PartnerInsert = {
  full_name: string;
  whatsapp_number: string;
  country: string;
  church: string;
  status: "new";
  source: string;
  preferred_communication_method: "whatsapp";
  hub_id: string;
  church_id: string;
};

/** One bulk POST per 500 — each chunk is a single atomic statement. */
export async function insertPartners(rows: PartnerInsert[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    await rest(`partners`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
  }
}

export async function markBatchSubmitted(
  batchId: string,
  acceptedCount: number,
): Promise<void> {
  await rest(`hub_ingest_batches?id=eq.${encodeURIComponent(batchId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "submitted",
      accepted_count: acceptedCount,
      submitted_at: new Date().toISOString(),
    }),
  });
}

export type HubPartnerRow = {
  id: string;
  full_name: string;
  whatsapp_number: string;
  church: string | null;
  created_at: string;
};

/**
 * The partners this hub has uploaded, newest first. Paged under PostgREST's
 * silent 1000-row cap; hubs run tens-to-hundreds of rows, but a big hub must
 * not silently truncate.
 */
export async function getHubPartners(hubId: string): Promise<HubPartnerRow[]> {
  const out: HubPartnerRow[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const rows = await rest<HubPartnerRow[]>(
      `partners?hub_id=eq.${encodeURIComponent(hubId)}` +
        `&select=id,full_name,whatsapp_number,church,created_at` +
        `&order=created_at.desc,id.asc&limit=${page}&offset=${offset}`,
    );
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
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
