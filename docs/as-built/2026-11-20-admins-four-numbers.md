# Admins: four numbers, chart, quadrant side panel

_2026-11-20 · Decision 0045_

Pure `src/lib/poc/admins-metrics.ts` (tested: `sumForms`, `totalsBy`, `metricSeries`, `resolveMetric`); `loadAdminsInput` in `src/lib/poc/admins-data.ts` reads 12 months of `cash_submissions` once (`CHART_MONTHS`) and derives the month's filing from them. `src/app/poc/admins/metrics.tsx`: `MetricsPanel` (four linked values + SVG column chart with CSS hover tooltips), `AdminsSidebar` (quadrant buttons, form button). Landing, quadrant and hub pages rewritten on them. No schema or route change.
