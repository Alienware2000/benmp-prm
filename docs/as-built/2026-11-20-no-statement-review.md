# No statement review queue

_2026-11-20 · Decision 0046_

`importPreparedStatement` (`src/lib/poc/statement-import.ts`) inserts every match into `payments` and returns `{ recorded, linked }`; `createPartner` and `updateImportRowStatus` removed. `POST /api/poc/giving/upload` is import-only; `src/app/poc/giving/upload/upload-client.tsx` rewritten without preview or pending review. Deleted `src/app/poc/giving/review`, `src/app/api/poc/giving/review`, the nav's Review tab. Giver CSV (`src/lib/poc/giver-contacts*.ts`) reads `payer_name` / `payer_phone_e164`. One-off `scripts/record-held-statement-lines.ts` for the 573 lines held at the time (GHS 108,196.60, almost all October). No schema change.
