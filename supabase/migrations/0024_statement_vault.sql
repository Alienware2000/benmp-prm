-- 0024: Statement vault — keep the original file behind every payment import.
-- Private bucket: no storage.objects policies are added, so only the service role
-- (server routes) can read or write. Staff download through a short-lived signed URL
-- from GET /api/poc/giving/imports/:id/file. No MIME allow-list: some bank ".xls"
-- exports are really HTML, and the uploader already validates the content by parsing it.

insert into storage.buckets (id, name, public, file_size_limit)
values ('statement-vault', 'statement-vault', false, 52428800)
on conflict (id) do update set public = false;

alter table public.payment_imports
  add column if not exists storage_path text,
  add column if not exists file_size_bytes bigint,
  add column if not exists content_type text;

comment on column public.payment_imports.storage_path is
  'Object path in the private statement-vault bucket: <provider>/<YYYY-MM>/<sha256>-<filename>. Null for batches imported before 0024.';
