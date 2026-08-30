/**
 * Legacy Ghana broadcast list — the pre-hub archive, readable for one purpose: sending.
 *
 * Separate from directory.ts on purpose. That module reads `partners`, which since the
 * 2026-08-25 cutover holds only hub-ingested people. This one reads
 * `legacy_ghana_contacts` (migration 0007), the archived pre-hub Ghana numbers.
 *
 * The two never mix: nothing here writes to `partners`, and no directory, giving,
 * reconciliation or hub surface reads this table. It exists to back a single audience
 * in the message composer.
 *
 * Rows map to the same DirectoryPartner shape the composer already uses, so opt-outs,
 * preview, confirmation and audit logging work unchanged. Giving is always zero — these
 * contacts predate the live ledger, so `{amount}` drafts are not meaningful for them.
 *
 * Server-only — the fetcher uses the service_role key.
 */

import type { DirectoryPartner } from "./directory";
import {
  fetchAllRows,
  mapPartners,
  parseTotalCount,
  type DbPartner,
} from "./directory";
import { memoWithTtl, supabaseRestFetcher, type Fetcher } from "./db";

const SELECT = "id,full_name,whatsapp_number,church,country,status";

/** No giving history for legacy contacts — every total resolves to zero. */
const NO_GIVING = new Map<string, number>();

/**
 * Load the whole legacy list. Paged explicitly (fetchAllRows) because PostgREST
 * truncates at 1,000 rows and this table holds ~11.6k.
 */
export async function loadLegacyGhanaContacts(
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<DirectoryPartner[]> {
  const rows = await fetchAllRows<DbPartner>(
    fetcher,
    `legacy_ghana_contacts?select=${SELECT}`,
    "id.asc",
  );
  return mapPartners(rows, NO_GIVING);
}

/** Keep repeated preview requests from re-reading the whole table. */
export const loadLegacyGhanaContactsCached = memoWithTtl(
  () => loadLegacyGhanaContacts(),
  60_000,
);

/** Row count for the audience picker — no need to load the rows themselves. */
export async function countLegacyGhanaContacts(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
    );
  const res = await fetch(`${url}/rest/v1/legacy_ghana_contacts?select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`Supabase legacy_ghana_contacts: ${res.status}`);
  }
  return parseTotalCount(res.headers.get("content-range"));
}
