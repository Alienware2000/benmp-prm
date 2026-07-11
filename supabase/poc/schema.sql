-- BENMP POC schema (Decision 0008) — Ghana + MoMo, Qodesh.
-- Standalone: the ONLY tables the POC needs. It intentionally does NOT use the full
-- MVP schema in supabase/migrations/0001 (deferred by Decision 0008).
-- Apply via the Supabase SQL Editor (dashboard) or psql with the DB connection string.
--
-- Conventions: money = integer minor units (never float); phone = E.164 match key.
-- Access is server-side via the service_role key (bypasses RLS); RLS is enabled with
-- no public policies so partner PII stays private (no anon reads).

create extension if not exists "pgcrypto";

-- 1. Registrations — from "Qodesh Benmp Members.xlsx" (no. / Name / Phone number).
--    No pledge column (the sheet has none) -> reminders are event-driven.
create table if not exists public.registrations (
  id          uuid primary key default gen_random_uuid(),
  source_no   integer,               -- the sheet's "no." column
  full_name   text not null,
  phone_raw   text,
  phone_e164  text,                  -- normalized match key; null if unnormalizable
  created_at  timestamptz not null default now()
);
create index if not exists registrations_phone_idx on public.registrations (phone_e164);
-- No unique on phone: real data has shared/duplicate numbers.

-- 2. Payments — from "QODESH MOMO.csv" (a MoMo merchant statement). Immutable ledger.
create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,   -- MoMo "Id" (Transaction ID) = idempotency key
  paid_at           timestamptz,            -- "Date"
  status            text,                   -- "Status"; we keep only 'Successful'
  payer_name        text,                   -- "From name"
  payer_phone_e164  text,                   -- extracted from "From" (FRI:233…/MSISDN), normalized
  amount_minor      bigint not null check (amount_minor >= 0),  -- "Amount" x 100
  currency          text not null default 'GHS',
  raw_row           jsonb,                  -- original CSV row, for audit
  imported_at       timestamptz not null default now()
);
create index if not exists payments_phone_idx on public.payments (payer_phone_e164);
create index if not exists payments_paid_at_idx on public.payments (paid_at desc);

-- 3. Opt-outs — consent check before any send (POC-3).
create table if not exists public.opt_outs (
  phone_e164  text primary key,
  reason      text,
  created_at  timestamptz not null default now()
);

-- 4. Sent messages — audit log of what the POC sent.
create table if not exists public.sent_messages (
  id                   uuid primary key default gen_random_uuid(),
  partner_ref          text,               -- registration id OR payment reference
  kind                 text,               -- 'thank_you' | 'reminder'
  to_phone             text,
  body                 text,
  status               text,               -- 'queued' | 'sent' | 'skipped' | 'failed'
  reason               text,
  provider_message_id  text,
  created_at           timestamptz not null default now()
);

-- Convenience view: the three reconciliation buckets by phone (the code path in
-- src/lib/reconcile.ts remains the source of truth for message planning; this view is
-- for dashboard inspection / SQL checks).
create or replace view public.reconciliation as
  select 'registered_paid'::text as bucket, r.id::text as ref, r.full_name as name,
         coalesce(sum(p.amount_minor), 0) as amount_minor
    from public.registrations r
    join public.payments p on p.payer_phone_e164 = r.phone_e164 and p.status = 'Successful'
   group by r.id, r.full_name
  union all
  select 'paid_unregistered', p.reference, p.payer_name, p.amount_minor
    from public.payments p
   where p.status = 'Successful'
     and not exists (select 1 from public.registrations r where r.phone_e164 = p.payer_phone_e164)
  union all
  select 'registered_unpaid', r.id::text, r.full_name, 0
    from public.registrations r
   where not exists (
     select 1 from public.payments p
      where p.payer_phone_e164 = r.phone_e164 and p.status = 'Successful'
   );

-- RLS: enabled, no public policies. Server code uses the service_role key (bypasses RLS).
alter table public.registrations enable row level security;
alter table public.payments      enable row level security;
alter table public.opt_outs      enable row level security;
alter table public.sent_messages enable row level security;
