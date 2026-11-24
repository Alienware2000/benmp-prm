# Form: members marked, giving in dollars

_2026-11-24 · Decision 0047 · migration 0027_

`src/app/cash/cash-form.tsx` (required USD amount; Members section loaded per church via `GET /api/cash/members`, four marks per member, "Mark the rest Active", submit disabled until all marked; Add New Members inside it), `src/app/api/cash/submit/route.ts` (`givenUsd`, `marks`; submission → marks → removals → new members, all undone on failure), `parseGivenUsd` and `validateMemberMarks` in `src/lib/cash/validation.ts` (tested), `listChurchMembers` / `insertMemberMarks` / `removeMembers` / `restoreRemovedBy` in `src/lib/cash/db.ts`. Hub: `restoreHubPartners`, `POST /api/hub/partners/restore`, `src/app/hub/partners/removed-list.tsx`. Hub summary and Admins read `given_usd_cents` and show dollars for every hub.
