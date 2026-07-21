-- Remove partners with no phone number at all.
-- Apply via the Supabase SQL Editor. Run the whole file in one go.
--
-- Decided by BENMP staff 2026-07-21: a partner record with a blank phone column cannot be
-- reached and should not be in the database.
--
-- SCOPE IS DELIBERATELY NARROW — `whatsapp_number IS NULL` only (2,128 rows).
-- It does NOT touch the 161 rows that hold a non-phone value in that column: 45 of those
-- are the column-shifted import rows whose real phone sits in `church` and is still
-- recoverable. Deleting those would throw away a number we already have.
--
-- Expected: 15,329 partners -> 13,201.

begin;

-- 1. Archive first. The delete is irreversible; this is the undo.
--    Same shape as partners, plus when and why it was archived.
create table if not exists public.partners_archive (like public.partners including defaults);

alter table public.partners_archive
  add column if not exists archived_at timestamptz not null default now(),
  add column if not exists archived_reason text;

-- Enable RLS with no policies, matching partners — archived rows are still partner PII.
alter table public.partners_archive enable row level security;

insert into public.partners_archive
select p.*, now(), 'no_phone_number_2026_07_21'
  from public.partners p
 where p.whatsapp_number is null;

-- 2. Delete exactly what was archived.
delete from public.partners
 where whatsapp_number is null;

commit;

-- 3. Verify. Expect: remaining = 13201, archived = 2128, still_blank = 0.
select
  (select count(*) from public.partners)                                        as remaining,
  (select count(*) from public.partners_archive
    where archived_reason = 'no_phone_number_2026_07_21')                        as archived,
  (select count(*) from public.partners where whatsapp_number is null)           as still_blank;

-- ── UNDO ──────────────────────────────────────────────────────────────────────
-- Restores every row this migration removed. Safe to re-run: on conflict does nothing.
--
-- insert into public.partners (
--   id, full_name, mobile_number, whatsapp_number, email, country, city, church,
--   denomination, partner_since, partnership_level, preferred_giving_frequency,
--   preferred_communication_method, birthday, status, tags, notes, source, assigned_to,
--   lifetime_giving_minor, lifetime_giving_currency, last_contribution_date,
--   last_contacted_at, active_year_covered_until, attention_tier, created_by,
--   created_at, updated_at
-- )
-- select
--   id, full_name, mobile_number, whatsapp_number, email, country, city, church,
--   denomination, partner_since, partnership_level, preferred_giving_frequency,
--   preferred_communication_method, birthday, status, tags, notes, source, assigned_to,
--   lifetime_giving_minor, lifetime_giving_currency, last_contribution_date,
--   last_contacted_at, active_year_covered_until, attention_tier, created_by,
--   created_at, updated_at
-- from public.partners_archive
-- where archived_reason = 'no_phone_number_2026_07_21'
-- on conflict (id) do nothing;
