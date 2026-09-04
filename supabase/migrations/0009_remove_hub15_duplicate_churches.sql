-- Remove two Hub 15 churches and their three partners (office instruction, 2026-09-04).
--
-- Context: 12 church names appear in more than one hub. That is legal by design —
-- Decision 0018 makes a church unique within its hub, not globally, because real
-- churches share names across hubs (Akropong sits in hubs 11, 23 and 30). The office
-- reviewed the clashes and confirmed:
--
--   * Katamanso and Adjei Kojo: Hub 13's are the churches with actual buildings.
--   * Ashalaja: Hub 28's is the one with a building, so Hub 22's entry STAYS
--     (explicitly confirmed — do not remove it).
--   * Hub 15's Katamanso is a duplicate and goes.
--   * Hub 15's Kubekrom goes too. It is not a cross-hub duplicate; the office asked
--     for it to be removed from Hub 15's list.
--
-- Three partners sit on those two churches. They came from a single Hub 15 ingest
-- batch, have NO payments and have NEVER been messaged, so removing them loses no
-- financial or communication history:
--
--   Samson Bortei Oni  +233270377307  Katamanso
--   Josephine Wayo     +233543261416  Katamanso
--   Edmund Adda        +233204307834  Kubekrom
--
-- Archived before deletion, following the precedent set by migrations 0003/0004
-- (Decision 0009): every removal is copied to public.partners_archive first and is
-- recoverable with the undo at the foot of this file.
--
-- Adjei Kojo is deliberately NOT touched: the office confirmed Hub 13 and Hub 15 hold
-- two genuinely different churches of that name, both with partners.

begin;

-- The two Hub 15 churches, resolved by hub number so a same-named church in another
-- hub can never be caught by mistake.
create temporary table doomed_churches on commit drop as
select c.id, c.name
from public.hub_churches c
join public.hubs h on h.id = c.hub_id
where h.hub_number = 15
  and c.name in ('Katamanso', 'Kubekrom');

-- Guard: expect exactly the two churches described above.
do $$
declare n int;
begin
  select count(*) into n from doomed_churches;
  if n <> 2 then
    raise exception 'Expected 2 Hub 15 churches, found %. Aborting.', n;
  end if;
end $$;

-- Archive the partners before they are removed.
insert into public.partners_archive
select p.*
from public.partners p
where p.church_id in (select id from doomed_churches);

-- Guard: expect exactly the three partners named above, and no giving history.
do $$
declare n int; paid int;
begin
  select count(*) into n
    from public.partners
   where church_id in (select id from doomed_churches);
  if n <> 3 then
    raise exception 'Expected 3 partners on those churches, found %. Aborting.', n;
  end if;

  select count(*) into paid
    from public.payments pay
    join public.partners p on p.whatsapp_number = pay.payer_phone_e164
   where p.church_id in (select id from doomed_churches);
  if paid > 0 then
    raise exception 'Those partners have % payment(s). Aborting.', paid;
  end if;
end $$;

-- Partners first: hub_churches.id is referenced by partners.church_id, so the church
-- delete would be rejected while they exist.
delete from public.partners
 where church_id in (select id from doomed_churches);

delete from public.hub_churches
 where id in (select id from doomed_churches);

commit;

-- Undo (run as one statement if the office reverses this):
--
--   begin;
--   insert into public.hub_churches (hub_id, name, name_key)
--   select h.id, v.name, upper(v.name)
--     from public.hubs h
--     cross join (values ('Katamanso'), ('Kubekrom')) as v(name)
--    where h.hub_number = 15;
--
--   insert into public.partners
--   select * from public.partners_archive
--    where whatsapp_number in
--      ('+233270377307', '+233543261416', '+233204307834');
--   -- then re-point church_id at the re-created churches by name.
--   commit;
--
-- NOTE: scripts/data/ghana-hubs-churches.json must also drop these two names from
-- hub 15, or the next run of load-hub-seed.ts will re-create them.
