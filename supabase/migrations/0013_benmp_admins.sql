-- 0013: BENMP admins exclusion list.
--
-- Admins (office staff, finance team, etc.) may appear in payment data
-- because they handle money transfers, but they are NOT givers — they
-- should never appear in the giver insight groups (top/consistent/ordinary)
-- or be messaged as partners. This table holds their names and phone
-- numbers so the reconciliation pipeline can exclude them.
--
-- The table is populated by the office (a list will be provided). For now
-- the schema is ready and empty — add rows as needed.

create table if not exists public.benmp_admins (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_e164 text,
  role text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Name matching is case/whitespace-insensitive (upper, single-spaced).
alter table public.benmp_admins
  add column if not exists name_key text
  generated always as (upper(regexp_replace(trim(full_name), '\s+', ' ', 'g'))) stored;

create unique index if not exists benmp_admins_name_key_idx
  on public.benmp_admins (name_key);

alter table public.benmp_admins enable row level security;

-- Same posture as the rest of the schema: service-role access from the app.
-- No anon policies; the app reads/writes server-side.

create trigger benmp_admins_set_updated_at
before update on public.benmp_admins
for each row execute function public.set_updated_at();

comment on table public.benmp_admins is 'BENMP office staff/admins excluded from giver insights and messaging. Populated by the office.';
comment on column public.benmp_admins.full_name is 'Admin full name as it appears in payment data.';
comment on column public.benmp_admins.phone_e164 is 'Admin phone in E.164 (optional — for phone-based exclusion).';
comment on column public.benmp_admins.role is 'Office role (e.g. Finance, Admin, Coordinator).';
comment on column public.benmp_admins.name_key is 'Case/whitespace-insensitive name key for matching. Auto-generated.';