-- Legacy Ghana broadcast list (one-time populate from the pre-hub archive).
--
-- Context: the 2026-08-25 cutover (scripts/sql/archive-ghana-cutover.sql) moved the
-- pre-hub Ghana partners into archive.partners_pre_hub and cleared the live tables.
-- The office now wants one WhatsApp broadcast to that old list.
--
-- Deliberately NOT restored into public.partners. The hub platform is the only door
-- for live partner data (Decision 0018), so these contacts live in their own table:
-- they are messageable, but invisible to directory search, giving, reconciliation,
-- branch lists, hub logins and every partner count. Nothing joins this to partners.
--
-- Consent is still shared: the send path checks public.opt_outs by phone, so a STOP
-- here also protects the number if it later arrives through a hub upload.

create table if not exists public.legacy_ghana_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  whatsapp_number text not null,
  church text,
  country text,
  status text,
  -- Set when a broadcast batch has gone out, so a re-run cannot double-send.
  last_sent_at timestamptz,
  source_partner_id uuid,
  created_at timestamptz not null default now(),
  unique (whatsapp_number)
);

-- Populate once. `on conflict do nothing` + the unique phone keeps a re-run a no-op
-- and collapses the duplicate numbers in the archive down to one row each.
insert into public.legacy_ghana_contacts
  (full_name, whatsapp_number, church, country, status, source_partner_id)
select distinct on (whatsapp_number)
  full_name, whatsapp_number, church, country, status, id
from archive.partners_pre_hub
where country ilike '%ghana%'
  and whatsapp_number is not null
  and btrim(whatsapp_number) <> ''
order by whatsapp_number, id
on conflict (whatsapp_number) do nothing;

create index if not exists legacy_ghana_contacts_sent_idx
  on public.legacy_ghana_contacts (last_sent_at);

-- Same posture as the rest of the schema: RLS on, no anon policies. The app reads it
-- server-side with the service role; hub-admin sessions never query this table.
alter table public.legacy_ghana_contacts enable row level security;
