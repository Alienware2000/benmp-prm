-- 0005: Ghana hub admin platform (Decision 0018, HP-1).
-- Numbering note: 0002-0004 were applied directly to the hosted database
-- (foundation config; the two archived-deletion migrations recorded in
-- docs/db-schema.md) before this file series resumed, so this file continues
-- after them rather than reusing a number that already ran in production.
--
-- Additive only: nothing here touches the existing POC tables. The
-- archive-and-clear cutover is a separate, later step (Decision 0018 item 7).

-- Hubs are identified by number, always (Decision 0018 item 1). Leader names
-- are display labels, never identifiers.
create table public.hubs (
  id uuid primary key default gen_random_uuid(),
  hub_number int not null unique check (hub_number > 0),
  leader_name text not null,
  country text not null default 'Ghana',
  created_at timestamptz not null default now()
);

-- A church is unique within its hub; the same name may exist in other hubs.
-- name is Title Case for display; name_key (upper, single-spaced) is identity.
create table public.hub_churches (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs (id) on delete cascade,
  name text not null,
  name_key text not null,
  created_at timestamptz not null default now(),
  unique (hub_id, name_key)
);

-- One login per hub: username = hub number, initial password = hub number,
-- must_change_password forces a real one on first login.
create table public.hub_accounts (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null unique references public.hubs (id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- Ingest audit trail: the batch (who/when/file/mapping) ...
create table public.hub_ingest_batches (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs (id) on delete cascade,
  file_name text not null,
  sheet_name text not null,
  column_map jsonb not null,
  row_count int not null default 0,
  accepted_count int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

-- ... and every raw row as uploaded, plus what became of it after preview edits.
create table public.hub_ingest_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.hub_ingest_batches (id) on delete cascade,
  row_index int not null,
  raw jsonb not null,
  name text,
  phone_e164 text,
  church_id uuid references public.hub_churches (id),
  status text not null default 'accepted' check (status in ('accepted', 'removed')),
  issues jsonb not null default '[]'::jsonb
);

create index hub_ingest_rows_batch_idx on public.hub_ingest_rows (batch_id);

-- Hub-ingested people land in the standing partners table with these links.
alter table public.partners
  add column if not exists hub_id uuid references public.hubs (id),
  add column if not exists church_id uuid references public.hub_churches (id);

-- Same posture as the rest of the schema: RLS on, no anon policies; the app
-- reads and writes server-side with the service role.
alter table public.hubs enable row level security;
alter table public.hub_churches enable row level security;
alter table public.hub_accounts enable row level security;
alter table public.hub_ingest_batches enable row level security;
alter table public.hub_ingest_rows enable row level security;
