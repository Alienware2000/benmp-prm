# Faster staff pages: parallel paging, smaller reads, a cache that fits

_2026-11-24_

After the October import the dashboard took ~26 s, Admins ~15 s, Messages ~14 s per load. Two causes: every full-table read paged PostgREST 1,000 rows at a time **in sequence** (~0.35 s a round trip; `partners` is 18,284 rows), and the reconciliation result (3.3 MB) passed the Next.js data cache's 2 MB item limit, so it was never cached.

- `src/lib/poc/paging.ts` (tested): `pageAll` fetches pages 6 at a time; `mapConcurrent` runs chunked `in.(…)` lookups 6 at a time, in order. Used by `fetchAll` (`poc/db.ts`), `fetchAllRows` (`directory.ts`), `restAll` (`hub/db.ts`), `loadPartners` (`statement-import.ts`), the dashboard, Admins and three `/api/poc/*` routes, and the giving ledger's partner lookups.
- Payment reads that page by `paid_at` now end the order on `id` so pages cannot overlap; reconciliation and the giving ledger select `raw_row->>matched_partner_id` instead of the whole statement row.
- `loadReconciliationCached` is an in-memory `memoWithTtl` (2 min); `getDashboardTilesCached` (Next.js cache, tag `poc-giving`); the dashboard's three reads run together. Admins keeps its partner list (for per-hub counts) in memory for 5 min; forms stay live.

Measured on a production build against the live database: dashboard 26 s → 5 s cold, instant warm; Admins 15 s → 1.6 s; Messages 14 s → 3 s cold, instant warm; giving ledger 14 s → 5 s. Output compared with `main`: identical, except gifts with the same timestamp now in a fixed order. No schema change.
