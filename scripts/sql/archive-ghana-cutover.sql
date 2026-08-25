-- Ghana archive-and-clear cutover (HP-4, Decision 0018 item 7).
--
-- RUN ONLY AFTER: (1) office sign-off, and (2) scripts/export-ghana-archive.ts
-- has produced the CSV files and you have compared its row counts to the ones
-- this script reports. This is the step that empties the old POC data.
--
-- One transaction, self-verifying: if any archive count does not match the
-- live count it is copying, the whole thing aborts and NOTHING is deleted.
-- Deliberately NOT re-runnable — a second run fails on "table already exists"
-- rather than silently overwriting the archive.
--
-- What moves: pre-hub partners (hub_id IS NULL — hub uploads stay live),
-- and all registrations, payments, sent_messages.
-- The `archive` schema is not exposed through PostgREST (only `public` is),
-- so nothing in the app can reach it.

begin;

create schema archive;

create table archive.partners_pre_hub as
  select *, now() as archived_at from public.partners where hub_id is null;
create table archive.registrations as
  select *, now() as archived_at from public.registrations;
create table archive.payments as
  select *, now() as archived_at from public.payments;
create table archive.sent_messages as
  select *, now() as archived_at from public.sent_messages;

-- Abort the transaction unless every archive table exactly matches what it copied.
do $$
declare
  live bigint;
  arch bigint;
begin
  select count(*) into live from public.partners where hub_id is null;
  select count(*) into arch from archive.partners_pre_hub;
  if live <> arch then
    raise exception 'partners mismatch: live % vs archive %', live, arch;
  end if;

  select count(*) into live from public.registrations;
  select count(*) into arch from archive.registrations;
  if live <> arch then
    raise exception 'registrations mismatch: live % vs archive %', live, arch;
  end if;

  select count(*) into live from public.payments;
  select count(*) into arch from archive.payments;
  if live <> arch then
    raise exception 'payments mismatch: live % vs archive %', live, arch;
  end if;

  select count(*) into live from public.sent_messages;
  select count(*) into arch from archive.sent_messages;
  if live <> arch then
    raise exception 'sent_messages mismatch: live % vs archive %', live, arch;
  end if;

  raise notice 'archive verified: partners_pre_hub=%, all counts match', arch;
end $$;

-- The clear. If any row is still referenced by a table not being cleared,
-- the FK violation aborts the whole transaction — fail closed, nothing lost.
delete from public.sent_messages;
delete from public.payments;
delete from public.registrations;
delete from public.partners where hub_id is null;

-- What the fresh-start world looks like: only hub-uploaded partners remain.
select
  (select count(*) from public.partners) as partners_remaining_all_hub_uploads,
  (select count(*) from archive.partners_pre_hub) as archived_partners,
  (select count(*) from archive.registrations) as archived_registrations,
  (select count(*) from archive.payments) as archived_payments,
  (select count(*) from archive.sent_messages) as archived_sent_messages;

commit;
