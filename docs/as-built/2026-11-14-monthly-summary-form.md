# Monthly Summary Form

_2026-11-14 · Decision 0039 · PR #112_

`src/app/cash/cash-form.tsx` (required summary, Add New Members, Ghana-only optional cash), `src/app/api/cash/submit/route.ts` (checks everything before writing; members after the submission, rolled back on failure), `src/lib/cash/new-members.ts` (hub Upload validation, skip-don't-edit), `validateSummaryCounts` now requires all four, `validateDeposits` allows none. Hub Monthly summary gained the four numbers (`SummaryCounts`, `summaryTotals`) and Ghana-only cash. No migration.
