# Upload Hardening — Design Spec (Subsystem #2)

_Date: 2026-10-07_

## 1. Goal

Prevent double-counting from re-uploading the same statement file, give staff a visible audit trail of every upload, and add structured test coverage for the dedup and batch-tracking logic. The existing preview→commit upload flow stays unchanged — this is a hardening pass, not a redesign.

## 2. Context & constraints

- **Existing audit trail**: `payment_imports` (batch: provider, filename, status, row/matched/ambiguous counts, created_at) + `payment_import_rows` (per-row: raw_row, normalized_row, payment_reference, match_status). Row-level dedup already exists via `unique index on payment_import_rows(payment_reference)`.
- **The gap**: the same file can be uploaded multiple times as separate batches. The live DB shows the MoMo CSV imported 3 times (same filename, 3 batches). Row dedup prevents duplicate *payments*, but staff see 3 batches and can't tell which is canonical. No file-level identity exists.
- **Existing upload actions**: `preview` (parse + match, no writes), `import` (parse + match + create batch + insert rows + promote auto-matched), `commit` (parse + match + promote with manual decisions, no batch), `commitDeferred` (promote deferred rows, no batch).
- **Only `import` creates a batch** — `commit` and `commitDeferred` promote payments without creating a batch record. This is a pre-existing gap; this spec adds the hash check to `import` (where the batch is created) and `commit` (where payments are inserted without a batch — the hash prevents re-committing the same file's payments).
- **Decision 0007**: CSV import is the sole money intake. No payment provider.

## 3. Schema change

```sql
-- 0022: File-hash dedup on payment_imports
alter table public.payment_imports
  add column if not exists file_hash text;

create unique index if not exists payment_imports_provider_file_hash_idx
  on public.payment_imports(provider, file_hash)
  where file_hash is not null;
```

- `file_hash` is the SHA-256 hex of the uploaded file's content.
- The unique index is **partial** (`where file_hash is not null`) — legacy batches without a hash don't conflict.
- A re-upload of the same file content for the same provider hits the unique index → 409.
- A different file (even with the same filename) produces a different hash → succeeds. This handles corrections and updated statements.

No `created_by` column — the POC uses a shared password, not individual staff accounts. Add when real auth lands.

## 4. Dedup logic (`src/lib/poc/import-dedup.ts`)

```typescript
import { createHash } from "crypto";

/** Compute SHA-256 hex of file content. */
export function computeFileHash(buffer: ArrayBuffer): string {
  return createHash("sha256").update(new Uint8Array(buffer)).digest("hex");
}

export type ExistingBatch = {
  id: string;
  provider: string;
  filename: string;
  status: string;
  row_count: number;
  created_at: string;
};

/** Check if a file hash already exists for this provider. Returns the prior batch if so. */
export async function findDuplicateBatch(
  provider: string,
  fileHash: string,
  rest: <T>(path: string, init?: RequestInit) => Promise<T>,
): Promise<ExistingBatch | null> {
  const rows = await rest<ExistingBatch[]>(
    `payment_imports?select=id,provider,filename,status,row_count,created_at` +
      `&provider=eq.${encodeURIComponent(provider)}` +
      `&file_hash=eq.${encodeURIComponent(fileHash)}&limit=1`,
  );
  return rows[0] ?? null;
}
```

## 5. Upload route changes (`src/app/api/poc/giving/upload/route.ts`)

### 5.1 `import` action (creates a batch)

After parsing the file and before `createImportBatch`:
1. Compute `fileHash = computeFileHash(await file.arrayBuffer())`.
2. Call `findDuplicateBatch(source, fileHash, rest)`.
3. If duplicate found → return 409: `{ ok: false, error: "duplicate_file", existingBatch: { id, filename, created_at, row_count } }`.
4. Pass `file_hash: fileHash` into `createImportBatch`.

### 5.2 `commit` action (no batch, but inserts payments)

Same check: compute hash, check for duplicate, return 409 if found. This prevents re-committing payments from a file that was already imported.

### 5.3 `preview` action (no writes)

Compute and return `fileHash` in the response so the client can warn "this file was already uploaded" before the user hits import. No dedup check — preview is read-only.

### 5.4 `commitDeferred` action

This action receives rows as JSON, not a file — no file to hash. Skip dedup here (the rows already have payment_references with their own dedup).

### 5.5 `createImportBatch` update

Add `file_hash` to the insert payload:
```typescript
async function createImportBatch({
  provider, filename, rowCount, matchedCount, ambiguousCount, fileHash,
}: {
  provider: string; filename: string; rowCount: number;
  matchedCount: number; ambiguousCount: number; fileHash: string;
}): Promise<string> {
  // ... same as before, add file_hash: fileHash to the JSON body
}
```

## 6. Upload history page (`/poc/giving/imports`)

Staff page (behind POC session, under `/poc` so proxy allows it).

### 6.1 Batch list (`GET /api/poc/giving/imports`)

Returns all `payment_imports` batches, newest first:
```json
{
  "ok": true,
  "batches": [
    {
      "id": "…",
      "provider": "momo",
      "filename": "103307789_…csv",
      "status": "processed",
      "row_count": 1315,
      "matched_count": 670,
      "ambiguous_count": 20,
      "file_hash": "a1b2c3d4…",
      "created_at": "2026-09-23T…"
    }
  ]
}
```

Optional query params: `?provider=momo&status=processed` for filtering.

### 6.2 Batch rows (`GET /api/poc/giving/imports/:id/rows`)

Returns the `payment_import_rows` for a specific batch:
```json
{
  "ok": true,
  "rows": [
    {
      "id": "…",
      "payment_reference": "momo:89802437658",
      "match_status": "promoted",
      "payer_name": "Kofi Mensah",
      "amount_minor": 2000
    }
  ]
}
```

### 6.3 UI (`/poc/giving/imports`)

- Table of batches: provider (badge), filename, status, row/matched/ambiguous counts, created_at (formatted), file_hash (first 8 chars, monospace).
- Filter dropdowns: provider, status.
- Click a batch row → expand or navigate to show that batch's import rows.
- Link from the existing `/poc/giving` page to this history page.

## 7. Tests

### Unit (`src/lib/poc/import-dedup.test.ts`)
- `computeFileHash` returns a 64-char hex string.
- Same content → same hash; different content → different hash.
- `findDuplicateBatch` returns the prior batch when a matching `(provider, file_hash)` exists; returns null when not found.

### Integration (upload route)
- Upload a file via `import` → batch created with `file_hash`.
- Re-upload the same file via `import` → 409 with `duplicate_file` and the existing batch's metadata.
- Upload a different file with the same provider → succeeds (different hash).
- `preview` returns `fileHash` in the response.

## 8. Files touched

```
supabase/migrations/0022_imports_file_hash.sql           (new — schema)
src/lib/poc/import-dedup.ts                              (new — hash + dedup logic)
src/lib/poc/import-dedup.test.ts                         (new — unit tests)
src/app/api/poc/giving/upload/route.ts                   (modify — hash + dedup check)
src/app/api/poc/giving/imports/route.ts                  (new — list batches)
src/app/api/poc/giving/imports/[id]/rows/route.ts        (new — list rows in batch)
src/app/poc/giving/imports/page.tsx                      (new — history page shell)
src/app/poc/giving/imports/imports-client.tsx            (new — client component)
docs/db-schema.md                                        (update — file_hash column)
docs/api-spec.md                                         (update — new routes)
```

## 9. Migration number

`0022_imports_file_hash.sql` — next after `0021_cash_submissions.sql`.

## 10. Out of scope

- Upload UI wizard redesign (user chose "dedup + history + tests" only).
- `created_by` tracking (POC has no individual staff auth).
- Backfilling `file_hash` on existing 7 batches (their file contents are not available; the column stays NULL and the partial unique index ignores them).
- `commitDeferred` dedup (rows arrive as JSON, not a file — row-level `payment_reference` dedup already covers this).