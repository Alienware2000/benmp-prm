/**
 * PostgREST access for hub auth (HP-2). Server-only — uses the service role,
 * mirroring src/lib/poc/db.ts. RLS has no anon policies on the hub tables, so
 * everything goes through these helpers.
 */
import type { HubAccountRecord } from "./auth";
import { normalizeNameKey, type ExistingPartner } from "./ingest";
import { isSensibleName } from "../poc/directory";
import {
  planHubPartnerDeletion,
  type DeletablePartner,
  type DeletePlan,
} from "./delete";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(): Record<string, string> {
  if (!SUPABASE_URL || !KEY) {
    throw new Error(
      "Supabase is not configured (URL / service role key missing)",
    );
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
    throw new Error(
      `${init?.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`,
    );
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
  hubs: {
    hub_number: number | null;
    name: string;
    regions: { code: string } | null;
  } | null;
};

const ACCOUNT_SELECT =
  "id,hub_id,username,password_hash,must_change_password," +
  "hubs(hub_number,name,regions(code))";

/**
 * How a hub is written in the UI. A numbered region leads with the number,
 * because that is what the office says out loud ("hub 8"); a named region is
 * just its name.
 */
export function hubLabel(
  hubNumber: number | null,
  name: string | null,
): string {
  if (hubNumber === null) return name ?? "";
  return name ? `${hubNumber} — ${name}` : `Hub ${hubNumber}`;
}

function toAccount(row: AccountRow | undefined): HubAccountRecord | null {
  if (!row || !row.hubs) return null;
  return {
    id: row.id,
    hub_id: row.hub_id,
    username: row.username,
    password_hash: row.password_hash,
    must_change_password: row.must_change_password,
    hub_number: row.hubs.hub_number,
    hub_label: hubLabel(row.hubs.hub_number, row.hubs.name),
    region_code: row.hubs.regions?.code ?? "UD_GHANA",
  };
}

export async function findHubAccountByUsername(
  username: string,
): Promise<HubAccountRecord | null> {
  const rows = await rest<AccountRow[]>(
    `hub_accounts?username=eq.${encodeURIComponent(username)}&select=${ACCOUNT_SELECT}`,
  );
  return toAccount(rows?.[0]);
}

/**
 * Lookup for the picker login (Decision 0020) — one account per hub, so the
 * hub id identifies the account.
 */
export async function findHubAccountByHubId(
  hubId: string,
): Promise<HubAccountRecord | null> {
  const rows = await rest<AccountRow[]>(
    `hub_accounts?hub_id=eq.${encodeURIComponent(hubId)}&select=${ACCOUNT_SELECT}`,
  );
  return toAccount(rows?.[0]);
}

export async function findHubAccountById(
  accountId: string,
): Promise<HubAccountRecord | null> {
  const rows = await rest<AccountRow[]>(
    `hub_accounts?id=eq.${encodeURIComponent(accountId)}&select=${ACCOUNT_SELECT}`,
  );
  return toAccount(rows?.[0]);
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
 *
 * `partnerId` and `hubId` are returned so the ingest can tell an admin re-uploading
 * their OWN partner (an edit, allowed) from one owned by another hub (still blocked).
 */
export async function findExistingPhones(
  phones: string[],
): Promise<Map<string, ExistingPhoneRow>> {
  const out = new Map<string, ExistingPhoneRow>();
  const unique = [...new Set(phones)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const list = chunk.map((p) => `"${p}"`).join(",");
    type Row = {
      id: string;
      hub_id: string | null;
      momo_phone_number?: string | null;
      whatsapp_number?: string | null;
      hubs: { hub_number: number | null; name: string | null } | null;
    };
    const select =
      "id,hub_id,momo_phone_number,whatsapp_number,hubs(hub_number,name)";
    const momoRows = await rest<Row[]>(
      `partners?momo_phone_number=in.(${encodeURIComponent(list)})&select=${select}`,
    );
    const waRows = await rest<Row[]>(
      `partners?whatsapp_number=in.(${encodeURIComponent(list)})&select=${select}`,
    );
    const info = (r: Row): ExistingPhoneRow => ({
      partnerId: r.id,
      hubId: r.hub_id,
      hubNumber: r.hubs?.hub_number ?? null,
      hubLabel: r.hubs ? hubLabel(r.hubs.hub_number, r.hubs.name) : null,
    });
    for (const r of momoRows) {
      if (r.momo_phone_number) out.set(r.momo_phone_number, info(r));
    }
    for (const r of waRows) {
      if (r.whatsapp_number) out.set(r.whatsapp_number, info(r));
    }
  }
  return out;
}

/**
 * Every partner this hub already has, as { partnerId, nameKey }, for re-upload
 * matching by name.
 *
 * Names rather than phones, because the field being corrected is usually the phone or
 * the church — see Decision 0024. Paged: PostgREST truncates at 1,000 and a large hub
 * can exceed that.
 */
export async function findHubPartnerNames(
  hubId: string,
): Promise<ExistingPartner[]> {
  const out: ExistingPartner[] = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await rest<
      {
        id: string;
        full_name: string | null;
        whatsapp_number: string | null;
        church: string | null;
      }[]
    >(
      `partners?hub_id=eq.${encodeURIComponent(hubId)}` +
        `&select=id,full_name,whatsapp_number,church&order=id.asc&limit=1000&offset=${offset}`,
    );
    for (const r of rows) {
      // A placeholder is not an identity: two "NO NAME" rows are not the same
      // person. Kept with an empty key so a phone match can still describe them.
      const nameKey = isSensibleName(r.full_name)
        ? normalizeNameKey(r.full_name)
        : "";
      out.push({
        partnerId: r.id,
        nameKey,
        name: r.full_name ?? "",
        whatsapp: r.whatsapp_number,
        church: r.church,
      });
    }
    if (rows.length < 1000) break;
  }
  return out;
}

export type ExistingPhoneRow = {
  partnerId: string;
  hubId: string | null;
  hubNumber: number | null;
  /** "12 — Asamankese" / "Kpandai"; null for a partner with no hub. */
  hubLabel: string | null;
};

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
  whatsapp_phone_e164: string | null;
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
  /** Null in a region that does not collect MoMo (Decision 0026). */
  momo_phone_number: string | null;
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

export type PartnerUpdate = {
  partnerId: string;
  hubId: string;
  fields: Partial<
    Pick<
      PartnerInsert,
      | "full_name"
      | "momo_phone_number"
      | "whatsapp_number"
      | "church"
      | "church_id"
      | "source"
    >
  >;
};

/**
 * Apply edits to partners the uploading hub already owns.
 *
 * One PATCH per partner: PostgREST has no per-row bulk update, and an edit run is a
 * few dozen rows at most, not thousands. Every statement carries `hub_id=eq.<hub>` as
 * well as the id — belt and braces, so that even a wrong partner id from a future bug
 * cannot reach another hub's row.
 */
export async function updatePartners(updates: PartnerUpdate[]): Promise<void> {
  for (const update of updates) {
    await rest(
      `partners?id=eq.${encodeURIComponent(update.partnerId)}` +
        `&hub_id=eq.${encodeURIComponent(update.hubId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(update.fields),
      },
    );
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

export type HubAccountMeta = {
  lastLoginAt: string | null;
  createdAt: string;
};

export async function getHubAccountMeta(
  accountId: string,
): Promise<HubAccountMeta | null> {
  const rows = await rest<
    { last_login_at: string | null; created_at: string }[]
  >(
    `hub_accounts?id=eq.${encodeURIComponent(accountId)}&select=last_login_at,created_at`,
  );
  const row = rows?.[0];
  return row
    ? { lastLoginAt: row.last_login_at, createdAt: row.created_at }
    : null;
}

export async function updateHubLeaderName(
  hubId: string,
  leaderName: string,
): Promise<void> {
  await rest(`hubs?id=eq.${encodeURIComponent(hubId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ leader_name: leaderName }),
  });
}

export type HubPartnerRow = {
  id: string;
  full_name: string;
  momo_phone_number: string;
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
        `&select=id,full_name,momo_phone_number,whatsapp_number,church,created_at` +
        `&order=created_at.desc,id.asc&limit=${page}&offset=${offset}`,
    );
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

/** The hub's country label, stamped onto partners it uploads. */
export async function getHubCountry(hubId: string): Promise<string> {
  const rows = await rest<{ country: string | null }[]>(
    `hubs?id=eq.${encodeURIComponent(hubId)}&select=country`,
  );
  return rows?.[0]?.country || "Ghana";
}

/** Whether this region collects a Ghana MoMo number (Decision 0026). */
export async function getRegionMomoRequired(
  regionCode: string,
): Promise<boolean> {
  const rows = await rest<{ momo_required: boolean }[]>(
    `regions?code=eq.${encodeURIComponent(regionCode)}&select=momo_required`,
  );
  // Unknown region reads as MoMo-required: the strict default is the safe one.
  return rows?.[0]?.momo_required ?? true;
}

export type HubSummary = {
  hubNumber: number | null;
  hubLabel: string;
  regionName: string;
  leaderName: string;
  churchCount: number;
  partnerCount: number;
};

export async function getHubSummary(hubId: string): Promise<HubSummary | null> {
  const id = encodeURIComponent(hubId);
  const hubs = await rest<
    {
      hub_number: number | null;
      name: string;
      leader_name: string;
      regions: { name: string } | null;
    }[]
  >(`hubs?id=eq.${id}&select=hub_number,name,leader_name,regions(name)`);
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
    hubLabel: hubLabel(hub.hub_number, hub.name),
    regionName: hub.regions?.name ?? "UD Ghana",
    leaderName: hub.leader_name,
    churchCount,
    partnerCount,
  };
}

/**
 * Does this hub have a login account? The embedded value is an object when
 * PostgREST sees the relationship as one-to-one (hub_accounts.hub_id is
 * `unique`) and an array when it does not, so both are handled — reading only
 * one shape silently emptied every dropdown in production.
 */
export function hasAccount(
  embedded: { id: string }[] | { id: string } | null | undefined,
): boolean {
  if (!embedded) return false;
  return Array.isArray(embedded) ? embedded.length > 0 : Boolean(embedded.id);
}

export type RegionOption = {
  code: string;
  name: string;
  /** "number" | "name" — how this region identifies a hub (Decision 0020). */
  hubIdentifier: string;
  hubs: { id: string; label: string }[];
};

/**
 * Everything the login picker renders: the regions, and the hubs inside each.
 *
 * Deliberately unauthenticated data — an admin has to pick their hub before
 * they can prove who they are. Nothing but the hub's id and its label: no
 * leader names, no counts, no account state, so knowing it gets an attacker no
 * further than knowing the hub numbers already did.
 *
 * Hubs without an account are omitted: offering a hub nobody can sign into
 * produces a login that always fails.
 */
export async function listRegionsForLogin(): Promise<RegionOption[]> {
  const regions = await rest<
    { code: string; name: string; hub_identifier: string }[]
  >("regions?select=code,name,hub_identifier&order=sort_order.asc");

  const hubs = await rest<
    {
      id: string;
      hub_number: number | null;
      name: string;
      regions: { code: string } | null;
      // PostgREST returns an OBJECT here, not an array: hub_accounts.hub_id is
      // `unique`, so the relationship is detected as one-to-one. Both shapes are
      // accepted rather than relying on that staying true.
      hub_accounts: { id: string }[] | { id: string } | null;
    }[]
  >(
    "hubs?select=id,hub_number,name,regions(code),hub_accounts(id)" +
      "&order=hub_number.asc.nullslast,name.asc",
  );

  return regions.map((r) => ({
    code: r.code,
    name: r.name,
    hubIdentifier: r.hub_identifier,
    hubs: hubs
      .filter((h) => h.regions?.code === r.code && hasAccount(h.hub_accounts))
      .map((h) => ({
        id: h.id,
        label: hubLabel(h.hub_number, h.name),
      })),
  }));
}

/** Submitted uploads for this hub, newest first (Decision 0029). */
export type HubUpload = {
  id: string;
  file_name: string;
  created_at: string;
  submitted_at: string | null;
  accepted_count: number;
};

export async function getHubUploads(hubId: string): Promise<HubUpload[]> {
  return rest<HubUpload[]>(
    `hub_ingest_batches?hub_id=eq.${encodeURIComponent(hubId)}&status=eq.submitted` +
      `&select=id,file_name,created_at,submitted_at,accepted_count&order=created_at.desc`,
  );
}

const inList = (values: readonly string[]) =>
  `in.(${values.map((v) => `"${v.replace(/"/g, "")}"`).join(",")})`;

/**
 * Remove partners on behalf of the hub that owns them (Decision 0029). Anyone
 * with giving on record is kept. Every removed row is copied into audit_log
 * first, so a mistaken deletion can be restored by the office.
 */
export async function deleteHubPartners(
  hubId: string,
  hubLabel: string,
  partnerIds: readonly string[],
): Promise<DeletePlan & { deleted: number }> {
  const ids = [...new Set(partnerIds)].slice(0, 5_000);
  const found: DeletablePartnerRow[] = [];
  const paidPhones = new Set<string>();
  const linkedPartnerIds = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const rows = await rest<DeletablePartnerRow[]>(
      `partners?id=${encodeURIComponent(inList(chunk))}&select=*`,
    );
    found.push(...rows);
    const phones = rows
      .flatMap((r) => [r.whatsapp_number, r.momo_phone_number])
      .filter((p): p is string => !!p);
    if (phones.length > 0) {
      const paid = await rest<{ payer_phone_e164: string }[]>(
        `payments?status=eq.Successful&select=payer_phone_e164` +
          `&payer_phone_e164=${encodeURIComponent(inList(phones))}`,
      );
      for (const p of paid) paidPhones.add(p.payer_phone_e164);
    }
    for (const table of ["contributions", "payment_import_rows"]) {
      const linked = await rest<{ partner_id: string }[]>(
        `${table}?select=partner_id&partner_id=${encodeURIComponent(inList(chunk))}`,
      );
      for (const l of linked) linkedPartnerIds.add(l.partner_id);
    }
  }

  const plan = planHubPartnerDeletion(hubId, ids, found, {
    paidPhones,
    linkedPartnerIds,
  });
  const byId = new Map(found.map((r) => [r.id, r]));
  for (let i = 0; i < plan.deleteIds.length; i += 100) {
    const chunk = plan.deleteIds.slice(i, i + 100);
    await rest(`audit_log`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        chunk.map((id) => ({
          action: "hub_partner_delete",
          entity_table: "partners",
          entity_id: id,
          before_data: byId.get(id),
          after_data: { deleted_by_hub_id: hubId, deleted_by_hub: hubLabel },
        })),
      ),
    });
    await rest(
      `partners?id=${encodeURIComponent(inList(chunk))}&hub_id=eq.${encodeURIComponent(hubId)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
  }
  console.log(
    JSON.stringify({
      source: "hub_partner_delete",
      hubId,
      requested: ids.length,
      deleted: plan.deleteIds.length,
      kept: plan.kept.length,
    }),
  );
  return { ...plan, deleted: plan.deleteIds.length };
}

type DeletablePartnerRow = DeletablePartner & Record<string, unknown>;
