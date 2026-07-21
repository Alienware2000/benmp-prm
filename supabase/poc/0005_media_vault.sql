-- Media vault: the pictures, videos and documents staff attach to partner messages.
-- Apply via the Supabase SQL Editor.
--
-- Why storage rather than bytes in a column: WhatsApp providers do not accept an upload on
-- the send call. They are handed a URL and fetch the file themselves, so every attachment
-- must be publicly reachable BEFORE a send references it.
--
-- Trade-off, stated plainly: the `media` bucket is public-read, so anyone with the URL can
-- fetch the file. That is a requirement of the provider, not a choice. Only put material
-- intended for broadcast in here — never partner exports, statements or anything private.

-- 1. The bucket. Public so the provider can GET the object.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- 2. The catalogue staff pick from.
create table if not exists public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  filename      text not null,               -- original name, for display
  mime_type     text not null,               -- validated against the WhatsApp allow-list in code
  size_bytes    bigint not null check (size_bytes > 0),
  kind          text not null,               -- 'image' | 'video' | 'audio' | 'document'
  storage_path  text not null unique,        -- object path inside the bucket
  public_url    text not null,               -- what gets handed to the provider as MediaUrl
  caption       text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);

create index if not exists media_assets_created_idx on public.media_assets (created_at desc);

-- Row metadata is read server-side with the service_role key; no anon access.
alter table public.media_assets enable row level security;

-- 3. Storage policies. Public read (the provider is an anonymous fetcher); writes are
--    service_role only, so uploads go through the app rather than straight from a browser.
drop policy if exists "media public read" on storage.objects;
create policy "media public read"
  on storage.objects for select
  using (bucket_id = 'media');

-- Verify: expect the bucket present and public.
select id, public from storage.buckets where id = 'media';
