# Three separate systems

_2026-11-20 · Decision 0044_

Deleted `src/app/hub/claim`, `src/app/api/hub/claim`, `src/lib/hub/claim.ts`, `src/app/hub/summary/[churchId]`, `src/app/poc/admins/[region]/[hubId]/[churchId]`, `src/lib/hub/church-members.ts`, `src/components/giving/member-month-grid.tsx`, `src/app/api/hub/givers`, `src/lib/hub/giver-export.ts`, `src/lib/hub/giving.ts`, `src/app/hub/givers-list.tsx`, and the payment/claim/member loaders in `src/lib/hub/db.ts`. `src/lib/hub/monthly.ts` is form-only (`reports`, `givingMinor`); `/hub` shows registered partners, churches and this month's forms. Office Admins (`admins-overview.ts`, `admins-data.ts`) reads giving from the forms and no longer loads payments. Giver CSV moved to `src/lib/poc/giver-contacts.ts` + `giver-contacts-db.ts`, office-wide by month. No schema change.
