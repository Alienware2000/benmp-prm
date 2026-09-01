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

import type { LegacyContact } from "./legacy-batches";
import {
  fetchAllRows,
  mapPartners,
  parseTotalCount,
  type DbPartner,
} from "./directory";
import { memoWithTtl, supabaseRestFetcher, type Fetcher } from "./db";

const SELECT =
  "id,full_name,whatsapp_number,church,country,status,last_sent_at,sms_sent_at";

/** No giving history for legacy contacts — every total resolves to zero. */
const NO_GIVING = new Map<string, number>();

/**
 * Load the whole legacy list. Paged explicitly (fetchAllRows) because PostgREST
 * truncates at 1,000 rows and this table holds ~11.6k.
 */
export async function loadLegacyGhanaContacts(
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<LegacyContact[]> {
  const rows = await fetchAllRows<
    DbPartner & { last_sent_at: string | null; sms_sent_at: string | null }
  >(fetcher, `legacy_ghana_contacts?select=${SELECT}`, "id.asc");
  // mapPartners gives the DirectoryPartner shape the composer expects; last_sent_at is
  // carried alongside so batching can tell who has already been messaged.
  const mapped = mapPartners(rows, NO_GIVING);
  return mapped.map((partner, i) => ({
    ...partner,
    lastSentAt: rows[i].last_sent_at,
    smsSentAt: rows[i].sms_sent_at,
  }));
}

/**
 * Stamp `last_sent_at` on the contacts a send actually delivered to. Called after
 * dispatch with only the ids whose outcome was "sent", so a skip or a provider failure
 * stays eligible for a retry.
 *
 * Never throws: the messages are already delivered by this point, and losing a marker
 * only risks a duplicate on a later batch. It logs loudly instead so the office can
 * reconcile by hand.
 */
export async function markLegacyContactsSent(
  ids: string[],
  column: "last_sent_at" | "sms_sent_at" = "last_sent_at",
): Promise<void> {
  if (ids.length === 0) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const now = new Date().toISOString();
  // Chunked so the id filter cannot outgrow the URL length limit.
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const filter = `id=in.(${batch.join(",")})`;
    try {
      const res = await fetch(
        `${url}/rest/v1/legacy_ghana_contacts?${filter}`,
        {
          method: "PATCH",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ [column]: now }),
        },
      );
      if (!res.ok) {
        console.error(
          JSON.stringify({
            evt: "legacy_mark_sent_failed",
            count: batch.length,
            status: res.status,
          }),
        );
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          evt: "legacy_mark_sent_failed",
          count: batch.length,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
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
