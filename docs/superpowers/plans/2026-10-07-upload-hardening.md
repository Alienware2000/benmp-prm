# Upload Hardening Implementation Plan (Subsystem #2)

**Spec:** `docs/superpowers/specs/2026-10-07-upload-hardening-design.md`
**Branch:** `feat/upload-hardening` (from `feat/cash-payment-form` or `main`)

## Tasks

### Task 1: Migration — file_hash column + unique index
- Create `supabase/migrations/0022_imports_file_hash.sql`
- Apply to live Supabase via SQL Editor (user runs it)
- Commit

### Task 2: Dedup logic module + tests
- Create `src/lib/poc/import-dedup.ts` (computeFileHash, findDuplicateBatch)
- Create `src/lib/poc/import-dedup.test.ts` (hash determinism, dedup detection)
- TDD: tests first, then implementation
- Commit

### Task 3: Upload route — add hash + dedup check
- Modify `src/app/api/poc/giving/upload/route.ts`
- `import` and `commit` actions: compute hash, check duplicate, 409 if found
- `preview` action: return hash in response
- `createImportBatch`: add file_hash to insert
- Commit

### Task 4: Batch list endpoint
- Create `src/app/api/poc/giving/imports/route.ts`
- Staff GET: list all payment_imports batches, optional provider/status filter
- Commit

### Task 5: Batch rows endpoint
- Create `src/app/api/poc/giving/imports/[id]/rows/route.ts`
- Staff GET: list payment_import_rows for a batch
- Commit

### Task 6: Upload history page
- Create `src/app/poc/giving/imports/page.tsx` (server shell)
- Create `src/app/poc/giving/imports/imports-client.tsx` (client: table, filters, expand rows)
- Commit

### Task 7: Docs + verification + PR
- Update `docs/db-schema.md` (file_hash column)
- Update `docs/api-spec.md` (new routes)
- Run tests, typecheck, lint
- Open PR