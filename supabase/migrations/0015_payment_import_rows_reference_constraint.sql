-- 0015: Make payment_import_rows.payment_reference usable by PostgREST on_conflict.
-- A partial unique index cannot satisfy `on_conflict=payment_reference`, which caused
-- 42P10 during upload. payment_reference is populated for all importer rows.

drop index if exists public.payment_import_rows_reference_idx;

create unique index if not exists payment_import_rows_reference_key
  on public.payment_import_rows(payment_reference);
