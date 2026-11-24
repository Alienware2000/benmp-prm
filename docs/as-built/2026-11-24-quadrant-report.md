# Quadrant report (PDF)

_2026-11-24 · Decision 0049_

`src/app/poc/admins/[region]/report/page.tsx` (+ `print-button.tsx`), linked from the quadrant page. Reuses `GroupedColumnChart`, `ColumnChart`, `SERIES`, `usdShort` (now exported from `src/app/poc/admins/metrics.tsx`; tooltips `print:hidden`, `emphasis` optional). `src/app/poc/layout.tsx` hides the staff header, mobile nav and assistant when printing. Builds on #121 and #122.
