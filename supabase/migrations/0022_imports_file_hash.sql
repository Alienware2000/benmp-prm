-- 0022: File-hash dedup on payment_imports — prevents re-uploading the same
-- statement file as a new batch. Row-level dedup already exists via the unique
-- index on payment_import_rows(payment_reference); this adds file-level identity.
-- The unique index is partial (file_hash IS NOT NULL) so legacy batches without
-- a hash don't conflict.

alter table public.payment_imports
  add column if not exists file_hash text;

create unique index if not exists payment_imports_provider_file_hash_idx
  on public.payment_imports(provider, file_hash)
  where file_hash is not null;