# Hub monthly summary

_2026-11-14 · Decision 0038 · PR #111_

`/hub/summary` server page + **Monthly summary** tab in `src/app/hub/nav.tsx`; pure `src/lib/hub/monthly.ts` (`buildHubMonth`, `buildMonthTrail`, `monthsEndingAt`; tested) over `getHubMonthlyInput` (hub-filtered churches, partners, matched payments, cash reports). Payment method falls back to `raw_row.source` for older MoMo/Ecobank imports, as Money by Church does. No schema change, no new API route.
