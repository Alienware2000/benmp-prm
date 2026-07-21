-- Remove the 45 partner records whose columns arrived shifted by the import.
-- Apply via the Supabase SQL Editor. Run the whole file in one go.
--
-- Decided by BENMP staff 2026-07-21: a record with no usable name is not a partner.
--
-- These rows have the row number or a sheet code in `full_name` ("1.0", "FL73"), the
-- phone in `church` ("233242743986.0"), and the real name in `whatsapp_number`
-- ("AbenaAmpofo,"). Verified before deleting: recovering each phone from `church` and
-- checking it against the payment ledger returns ZERO giving, so no contribution history
-- is lost.
--
-- Identified by the shape of `church` (a phone, not a place) rather than by a fixed id
-- list, so a re-import of the same broken file is caught too.
--
-- Expected: 13,201 partners -> 13,156.

begin;

insert into public.partners_archive
select p.*, now(), 'unusable_name_shifted_import_2026_07_21'
  from public.partners p
 where p.church ~ '^[0-9.+ ]+$';

delete from public.partners
 where church ~ '^[0-9.+ ]+$';

commit;

-- Verify. Expect: remaining = 13156, archived_now = 45, still_broken = 0.
select
  (select count(*) from public.partners)                                          as remaining,
  (select count(*) from public.partners_archive
    where archived_reason = 'unusable_name_shifted_import_2026_07_21')             as archived_now,
  (select count(*) from public.partners where church ~ '^[0-9.+ ]+$')              as still_broken;

-- ── UNDO ──────────────────────────────────────────────────────────────────────
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
-- where archived_reason = 'unusable_name_shifted_import_2026_07_21'
-- on conflict (id) do nothing;
