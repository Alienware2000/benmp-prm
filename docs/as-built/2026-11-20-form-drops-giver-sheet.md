# Monthly Summary Form: one giving total

_2026-11-20 · Decision 0043_

`src/app/cash/cash-form.tsx` (Cash Givers and Cash Transactions sections replaced by an optional Total giving box, Ghana only), `src/app/api/cash/submit/route.ts` (reads `givingTotal`; no file, no deposits), `parseGivingTotal` in `src/lib/cash/validation.ts` (tested), `insertSubmission` writes the parent row only. Deleted `/api/cash/preview`, `/api/cash/template`, `src/lib/cash/giver-file.ts`, `giver-upload.ts`, the giver/deposit validators and `reportedTransactionKeys`. No schema change.
