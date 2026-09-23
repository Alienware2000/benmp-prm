-- 0014: DB-backed MoMo/Ecobank import review for the POC giving uploader.
-- Every uploaded statement row is retained here first. Only safe/resolved rows
-- promote into public.payments, keeping the live giving ledger clean.

create table if not exists public.payment_imports (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  filename text not null,
  status text not null default 'uploaded',
  row_count integer not null default 0,
  matched_count integer not null default 0,
  ambiguous_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.payment_imports(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  contribution_id uuid,
  payment_reference text,
  raw_row jsonb not null,
  normalized_row jsonb not null default '{}'::jsonb,
  match_status text not null default 'unmatched',
  match_confidence numeric(5, 2),
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.payment_imports
  add column if not exists updated_at timestamptz not null default now();

alter table public.payment_import_rows
  add column if not exists payment_reference text,
  add column if not exists normalized_row jsonb not null default '{}'::jsonb,
  add column if not exists resolved_at timestamptz;

create index if not exists payment_imports_created_idx
  on public.payment_imports(created_at desc);

create index if not exists payment_import_rows_import_idx
  on public.payment_import_rows(import_id);

create index if not exists payment_import_rows_status_idx
  on public.payment_import_rows(match_status, created_at desc);

create unique index if not exists payment_import_rows_reference_idx
  on public.payment_import_rows(payment_reference)
  where payment_reference is not null;

alter table public.payment_imports enable row level security;
alter table public.payment_import_rows enable row level security;
