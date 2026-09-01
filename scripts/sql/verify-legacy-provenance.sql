-- Provenance check for legacy_ghana_contacts (Decision 0019/0020).
--
-- Proves the broadcast list is a faithful subset of the pre-hub archive: every row
-- traces to a real archived partner, and no name or phone was altered in the copy.
-- Read-only — safe to run any time.

-- 1. Every legacy row must match its source archive row EXACTLY on name and phone.
--    Expected: 0 rows. Anything here is a value that changed in transit.
select l.id, l.full_name, a.full_name as archive_name,
       l.whatsapp_number, a.whatsapp_number as archive_number
from public.legacy_ghana_contacts l
join archive.partners_pre_hub a on a.id = l.source_partner_id
where l.full_name is distinct from a.full_name
   or l.whatsapp_number is distinct from a.whatsapp_number;

-- 2. Every legacy row must point at a row that still exists in the archive.
--    Expected: 0.
select count(*) as orphaned_rows
from public.legacy_ghana_contacts l
left join archive.partners_pre_hub a on a.id = l.source_partner_id
where a.id is null;

-- 3. Count reconciliation. eligible_in_archive should equal legacy_rows (11,633):
--    Ghana rows with a non-empty phone, deduplicated by phone.
select
  (select count(*) from public.legacy_ghana_contacts) as legacy_rows,
  (select count(distinct whatsapp_number)
     from archive.partners_pre_hub
    where country ilike '%ghana%'
      and whatsapp_number is not null
      and btrim(whatsapp_number) <> '') as eligible_in_archive;

-- 4. No phone number may exist in the broadcast list that is absent from the archive.
--    Expected: 0. This is the direct "nothing was fabricated" check.
select count(*) as phones_not_in_archive
from public.legacy_ghana_contacts l
where not exists (
  select 1 from archive.partners_pre_hub a
   where a.whatsapp_number = l.whatsapp_number
);

-- 5. Send progress, for the record: 503 already messaged on 2026-08-30.
select count(*) filter (where last_sent_at is not null) as already_sent,
       count(*) filter (where last_sent_at is null)     as not_yet_sent,
       count(*)                                          as total
from public.legacy_ghana_contacts;
