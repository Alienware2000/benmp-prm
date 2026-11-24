-- 0027: Monthly Summary Form — amount given in US dollars, and each member marked.
--
-- Decision 0047. Every church reports the month's BENMP giving as a US-dollar
-- equivalent (`given_usd_cents`), replacing the Ghana-only cedi total. The form
-- also lists the church's members by name and each is marked active, new, lapsed
-- or remove; the marks are kept per form in `cash_submission_members`.
--
-- "Remove" never deletes anyone. The partner is stamped `removed_at` and
-- `removed_via_submission`, which hides them from the church's list; the hub
-- admin can restore them (clears both columns). The form is public, so a wrong
-- or mischievous mark must be reversible.

begin;

alter table public.cash_submissions
  add column if not exists given_usd_cents bigint not null default 0
    check (given_usd_cents >= 0);

create table public.cash_submission_members (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.cash_submissions(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  status text not null check (status in ('active', 'new', 'lapsed', 'remove')),
  created_at timestamptz not null default now(),
  unique (submission_id, partner_id)
);

create index cash_submission_members_partner_idx
  on public.cash_submission_members(partner_id);

alter table public.cash_submission_members enable row level security;

create policy cash_submission_members_insert_public
  on public.cash_submission_members for insert with check (true);
create policy cash_submission_members_select_staff
  on public.cash_submission_members for select
  using (auth.role() = 'authenticated');

alter table public.partners
  add column if not exists removed_at timestamptz,
  add column if not exists removed_via_submission uuid
    references public.cash_submissions(id) on delete set null;

create index if not exists partners_church_not_removed_idx
  on public.partners(church_id) where removed_at is null;

commit;

-- Undo:
--   begin;
--   alter table public.partners drop column removed_via_submission, drop column removed_at;
--   drop table public.cash_submission_members;
--   alter table public.cash_submissions drop column given_usd_cents;
--   commit;
