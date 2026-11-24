# Admins: members chart and finance chart

_2026-11-24 · Decision 0048_

`src/app/poc/admins/metrics.tsx`: `GroupedColumnChart` (four series, reference palette slots 1-4, emphasis from `?metric=`), `ColumnChart` takes a `format` (dollars for finance), fifth big value Given (USD). `monthlyTotals` in `src/lib/poc/admins-metrics.ts` (tested). Builds on #121 (`given_usd_cents`).
