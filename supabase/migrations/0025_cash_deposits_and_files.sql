-- 0025: Cash form — uploaded giver sheet + the month's deposit transactions.
--
-- Branches now upload their giver list as a CSV/Excel file instead of typing it,
-- and list the transaction ID(s) of the transfer(s) that carried the month's cash
-- to BENMP. The original sheet is kept in the statement vault (0024) under
-- `cash/<YYYY-MM>/...`; the transaction IDs let staff trace the cash to the MoMo or
-- bank statement where it arrived.
--
-- A transaction ID can be reported once across all submissions: the unique index
-- on its normalised form stops two churches (or one church twice) claiming the
-- same transfer.

begin;

alter table public.cash_submissions
  add column if not exists givers_file_path text,
  add column if not exists givers_file_name text,
  add column if not exists deposits_total_minor bigint not null default 0;

create table public.cash_submission_deposits (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.cash_submissions(id) on delete cascade,
  row_index int not null,
  transaction_id text not null,
  -- Uppercased with whitespace removed; what uniqueness is checked on.
  transaction_key text not null,
  channel text not null check (channel in ('momo', 'bank', 'other')),
  amount_minor bigint not null check (amount_minor > 0),
  deposited_on date not null,
  created_at timestamptz not null default now()
);

create unique index cash_submission_deposits_transaction_key_idx
  on public.cash_submission_deposits(transaction_key);
create index cash_submission_deposits_submission_idx
  on public.cash_submission_deposits(submission_id);

alter table public.cash_submission_deposits enable row level security;

create policy cash_submission_deposits_insert_public
  on public.cash_submission_deposits for insert with check (true);
create policy cash_submission_deposits_select_staff
  on public.cash_submission_deposits for select
  using (auth.role() = 'authenticated');

commit;

-- Undo:
--   begin;
--   drop table public.cash_submission_deposits;
--   alter table public.cash_submissions
--     drop column givers_file_path, drop column givers_file_name, drop column deposits_total_minor;
--   commit;
