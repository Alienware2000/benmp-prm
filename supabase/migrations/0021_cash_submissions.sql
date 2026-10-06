-- 0021: Cash payment submissions — public form intake for monthly cash collections.
-- Mirrors intake_submissions (0012): public insert, staff-only read/update.
-- One submission per (church, reporting_month) — no double-count.

begin;

create table public.cash_submissions (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id),
  hub_id uuid not null references public.hubs(id),
  church_id uuid not null references public.hub_churches(id),
  reporting_month date not null,
  total_registered int not null default 0,
  active_partners int not null default 0,
  new_registrations int not null default 0,
  lapsed int not null default 0,
  total_cash_minor bigint not null default 0,
  currency text not null default 'GHS',
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted'
    check (status in ('submitted', 'promoted', 'flagged')),
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, reporting_month)
);

create index cash_submissions_hub_idx on public.cash_submissions(hub_id);
create index cash_submissions_region_idx on public.cash_submissions(region_id);
create index cash_submissions_status_idx on public.cash_submissions(status);
create index cash_submissions_submitted_at_idx on public.cash_submissions(submitted_at desc);

create table public.cash_submission_givers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.cash_submissions(id) on delete cascade,
  row_index int not null,
  giver_name text,
  giver_phone text,
  amount_minor bigint not null check (amount_minor >= 0),
  transaction_ref text,
  created_at timestamptz not null default now(),
  unique (submission_id, transaction_ref)
);

create index cash_submission_givers_submission_idx on public.cash_submission_givers(submission_id);

alter table public.cash_submissions enable row level security;
alter table public.cash_submission_givers enable row level security;

create policy cash_submissions_insert_public
  on public.cash_submissions for insert with check (true);
create policy cash_submission_givers_insert_public
  on public.cash_submission_givers for insert with check (true);

create policy cash_submissions_select_staff
  on public.cash_submissions for select
  using (auth.role() = 'authenticated');
create policy cash_submission_givers_select_staff
  on public.cash_submission_givers for select
  using (auth.role() = 'authenticated');

create policy cash_submissions_update_staff
  on public.cash_submissions for update
  using (public.current_staff_role() in ('super_admin', 'admin', 'finance'));

create trigger cash_submissions_set_updated_at
  before update on public.cash_submissions
  for each row execute function public.set_updated_at();

commit;

-- Undo:
--   begin;
--   drop trigger cash_submissions_set_updated_at on public.cash_submissions;
--   drop table public.cash_submission_givers;
--   drop table public.cash_submissions;
--   commit;