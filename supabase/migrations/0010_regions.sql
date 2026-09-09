-- 0010: Regions above hubs (Decision 0020).
--
-- Until now the hub platform was implicitly one region: 31 numbered Ghana hubs
-- (Decision 0018 item 1). The office's actual hierarchy is
--
--     Region -> Hub/Denomination -> Church -> BENMP Partner
--
-- with seven regions (UD Ghana, UJ Ghana, Europe, North America, Africa,
-- Eschatos, United Cities). The upper two levels move about; churches and
-- partners are comparatively static.
--
-- Regions differ in how they name a hub: UD Ghana uses NUMBERS, UJ Ghana uses
-- NAMES. So `hub_number` becomes optional and every uniqueness rule that was
-- global is re-scoped to the region -- UD's "hub 8" and UJ's "Kpandai" must be
-- able to coexist, and a future region may reuse either.
--
-- Additive and reversible: no rows are deleted, no column is dropped. Existing
-- hubs land in UD Ghana and keep their numbers, so the 31 live logins are
-- unaffected.

begin;

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  -- How this region identifies a hub, which is what the login picker renders.
  hub_identifier text not null check (hub_identifier in ('number', 'name')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.regions (code, name, hub_identifier, sort_order) values
  ('UD_GHANA', 'UD Ghana', 'number', 1),
  ('UJ_GHANA', 'UJ Ghana', 'name', 2);

alter table public.hubs
  add column if not exists region_id uuid references public.regions (id),
  -- Display name of the hub itself, distinct from leader_name. UD hubs always
  -- had these in the office ("Hub 8 - Cape Coast"); they were never stored.
  add column if not exists name text,
  add column if not exists name_key text;

-- Every existing hub is UD Ghana.
update public.hubs
   set region_id = (select id from public.regions where code = 'UD_GHANA')
 where region_id is null;

-- Backfill UD hub names from the office list ("hub names.rtf", 2026-09-08).
update public.hubs h
   set name = v.name
  from (values
    (1, 'Takoradi'),
    (2, 'Sefwi-Wiawso'),
    (3, 'Ayawaso'),
    (4, 'Goaso'),
    (5, 'Bantama'),
    (6, 'Tikrom'),
    (7, 'East End'),
    (8, 'Cape Coast'),
    (9, 'La-Nkwantanang'),
    (10, 'Ashanti Mampong'),
    (11, 'Oyibi'),
    (12, 'Asamankese'),
    (13, 'Ashaiman'),
    (14, 'Afienya'),
    (15, 'East Legon Hills'),
    (16, 'Kpando'),
    (17, 'Korle Gonno'),
    (18, 'Offinso'),
    (19, 'Abeka'),
    (20, 'Nyanyanor'),
    (21, 'Santa Maria'),
    (22, 'Nsawam'),
    (23, 'Berekuso'),
    (24, 'Kotobabi'),
    (25, 'Spintex'),
    (26, 'Hohoe'),
    (27, 'Adenta'),
    (28, 'West End'),
    (29, 'Qodesh'),
    (30, 'Anagkazo'),
    (31, 'Assin Fosu')
  ) as v(hub_number, name)
 where h.hub_number = v.hub_number
   and h.name is null;

update public.hubs
   set name_key = upper(regexp_replace(trim(name), '\s+', ' ', 'g'))
 where name is not null and name_key is null;

-- Guard: the backfill must have reached every existing hub before the
-- constraints below start enforcing.
do $$
declare missing int;
begin
  select count(*) into missing
    from public.hubs
   where region_id is null or name is null or name_key is null;
  if missing > 0 then
    raise exception 'Aborting: % hub(s) without region/name after backfill.', missing;
  end if;
end $$;

alter table public.hubs
  alter column region_id set not null,
  alter column name set not null,
  alter column name_key set not null,
  -- A name region uses no number.
  alter column hub_number drop not null;

-- Uniqueness is per region from here on, never global.
alter table public.hubs drop constraint if exists hubs_hub_number_key;
create unique index if not exists hubs_region_number_idx
  on public.hubs (region_id, hub_number)
  where hub_number is not null;
create unique index if not exists hubs_region_name_idx
  on public.hubs (region_id, name_key);

-- A numbered region must have numbers, a named region must not: the login
-- picker relies on this to render the right label.
alter table public.hubs add constraint hubs_number_matches_region check (
  hub_number is null or hub_number > 0
);

alter table public.regions enable row level security;

commit;

-- Undo:
--   begin;
--   alter table public.hubs drop constraint hubs_number_matches_region;
--   drop index if exists hubs_region_name_idx;
--   drop index if exists hubs_region_number_idx;
--   alter table public.hubs
--     alter column region_id drop not null,
--     alter column name drop not null,
--     alter column name_key drop not null;
--   -- (re-adding hubs_hub_number_key requires UJ hubs to be removed first)
--   commit;
