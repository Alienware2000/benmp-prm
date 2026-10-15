-- Retire the four ESCHATOS section hubs created on 2026-10-13 (Decision 0035).
--
-- ESCHATOS hubs are countries, not sections. Brazil and Jamaica were already
-- countries and are kept (the seed loader reuses them). Asia, Middle East,
-- South America and Central America are replaced by their country hubs from
-- scripts/data/eschatos-hubs-churches.json.
--
-- Run AFTER `npx tsx --env-file=.env.local scripts/load-region-hubs-seed.ts eschatos`.
-- Refuses to delete if any of the four hubs has partners, cash submissions, or a
-- login that has been used. Their churches and logins go with them (on delete
-- cascade); there were none of the first and four unused of the second.

begin;

do $$
declare
  ids uuid[] := array(
    select h.id
      from public.hubs h
      join public.regions r on r.id = h.region_id
     where r.code = 'ESCHATOS'
       and h.name_key in ('ASIA', 'MIDDLE EAST', 'SOUTH AMERICA', 'CENTRAL AMERICA')
  );
begin
  if exists (select 1 from public.partners where hub_id = any (ids)) then
    raise exception 'a section hub has partners; move them to a country hub first';
  end if;
  if exists (select 1 from public.cash_submissions where hub_id = any (ids)) then
    raise exception 'a section hub has cash submissions; stop and ask';
  end if;
  if exists (
    select 1 from public.hub_accounts
     where hub_id = any (ids) and (last_login_at is not null or not must_change_password)
  ) then
    raise exception 'a section hub login has been used; stop and ask';
  end if;
  delete from public.hubs where id = any (ids);
  raise notice 'retired % section hubs', cardinality(ids);
end $$;

commit;

-- Check: 20 hubs, one per country, each with a login.
--   select h.name, h.country, count(c.id) as churches, (a.id is not null) as has_login
--     from hubs h join regions r on r.id = h.region_id
--     left join hub_churches c on c.hub_id = h.id
--     left join hub_accounts a on a.hub_id = h.id
--    where r.code = 'ESCHATOS' group by h.id, a.id order by h.name;
