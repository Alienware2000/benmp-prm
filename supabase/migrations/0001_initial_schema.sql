-- BENMP PRM initial schema draft.
-- This migration is intentionally broad enough to model the ministry workflow,
-- but still avoids payment card storage and provider lock-in.

create type public.staff_role as enum (
  'super_admin',
  'admin',
  'finance',
  'communications',
  'regional_coordinator',
  'prayer_team',
  'viewer'
);

create type public.partner_status as enum (
  'new',
  'active',
  'needs_follow_up',
  'paused',
  'inactive',
  'do_not_contact'
);

create type public.partnership_level as enum (
  'prayer',
  'monthly',
  'quarterly',
  'annual',
  'major',
  'one_time',
  'unknown'
);

create type public.giving_frequency as enum (
  'monthly',
  'quarterly',
  'annually',
  'one_time',
  'irregular',
  'unknown'
);

create type public.communication_channel as enum (
  'whatsapp',
  'sms',
  'email',
  'phone',
  'none'
);

create type public.payment_method as enum (
  'paystack_card',
  'paystack_mobile_money',
  'paypal',
  'bank_transfer',
  'cash',
  'check',
  'other'
);

create type public.contribution_status as enum (
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'cancelled'
);

create type public.task_status as enum (
  'open',
  'in_progress',
  'done',
  'cancelled'
);

create type public.prayer_request_status as enum (
  'open',
  'praying',
  'responded',
  'closed'
);

create type public.message_status as enum (
  'draft',
  'queued',
  'sent',
  'delivered',
  'failed',
  'cancelled'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.staff_role not null default 'viewer',
  full_name text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_country_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  country text not null,
  created_at timestamptz not null default now(),
  unique (staff_id, country)
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile_number text,
  whatsapp_number text,
  email text,
  country text,
  city text,
  church text,
  denomination text,
  partner_since date,
  partnership_level public.partnership_level not null default 'unknown',
  preferred_giving_frequency public.giving_frequency not null default 'unknown',
  preferred_communication_method public.communication_channel not null default 'whatsapp',
  birthday date,
  status public.partner_status not null default 'new',
  tags text[] not null default '{}',
  notes text,
  source text,
  assigned_to uuid references public.profiles(id) on delete set null,
  lifetime_giving_minor bigint not null default 0,
  lifetime_giving_currency text not null default 'USD',
  last_contribution_date date,
  last_contacted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  city text,
  starts_on date,
  ends_on date,
  status text not null default 'planned',
  funding_goal_minor bigint,
  funding_currency text not null default 'USD',
  souls_reported integer,
  report_summary text,
  public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  contribution_date date not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  payment_method public.payment_method not null default 'other',
  provider text,
  provider_reference text,
  status public.contribution_status not null default 'succeeded',
  raw_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table public.recurring_commitments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  provider text,
  provider_subscription_code text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  frequency public.giving_frequency not null default 'monthly',
  status text not null default 'active',
  next_payment_date date,
  last_payment_date date,
  failed_payment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_code)
);

create table public.partner_notes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete set null,
  request_text text not null,
  status public.prayer_request_status not null default 'open',
  is_sensitive boolean not null default true,
  assigned_to uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  reason text,
  channel public.communication_channel not null default 'whatsapp',
  priority text not null default 'medium',
  status public.task_status not null default 'open',
  due_on date,
  completed_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communication_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  filter_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.segment_members (
  segment_id uuid not null references public.communication_segments(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (segment_id, partner_id)
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel public.communication_channel not null,
  subject text,
  body text not null,
  provider_template_id text,
  category text,
  language text not null default 'en',
  status text not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communication_batches (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid references public.communication_segments(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  template_id uuid references public.message_templates(id) on delete set null,
  name text not null,
  channel public.communication_channel not null,
  status public.message_status not null default 'draft',
  scheduled_for timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.communication_batches(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  channel public.communication_channel not null,
  recipient text not null,
  subject text,
  body text not null,
  status public.message_status not null default 'draft',
  provider text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_imports (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  filename text not null,
  status text not null default 'uploaded',
  row_count integer not null default 0,
  matched_count integer not null default 0,
  ambiguous_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.payment_imports(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  contribution_id uuid references public.contributions(id) on delete set null,
  raw_row jsonb not null,
  match_status text not null default 'unmatched',
  match_confidence numeric(5, 2),
  notes text,
  created_at timestamptz not null default now()
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  workflow text not null,
  model text,
  input_summary text,
  output_summary text,
  tool_calls jsonb not null default '[]'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index partners_country_idx on public.partners(country);
create index partners_status_idx on public.partners(status);
create index partners_assigned_to_idx on public.partners(assigned_to);
create index contributions_partner_date_idx on public.contributions(partner_id, contribution_date desc);
create index contributions_campaign_idx on public.contributions(campaign_id);
create index recurring_commitments_partner_idx on public.recurring_commitments(partner_id);
create index follow_up_tasks_status_due_idx on public.follow_up_tasks(status, due_on);
create index prayer_requests_status_idx on public.prayer_requests(status);
create index communication_messages_partner_idx on public.communication_messages(partner_id);
create index audit_log_entity_idx on public.audit_log(entity_table, entity_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger partners_set_updated_at
before update on public.partners
for each row execute function public.set_updated_at();

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create trigger contributions_set_updated_at
before update on public.contributions
for each row execute function public.set_updated_at();

create trigger recurring_commitments_set_updated_at
before update on public.recurring_commitments
for each row execute function public.set_updated_at();

create trigger prayer_requests_set_updated_at
before update on public.prayer_requests
for each row execute function public.set_updated_at();

create trigger follow_up_tasks_set_updated_at
before update on public.follow_up_tasks
for each row execute function public.set_updated_at();

create trigger communication_segments_set_updated_at
before update on public.communication_segments
for each row execute function public.set_updated_at();

create trigger message_templates_set_updated_at
before update on public.message_templates
for each row execute function public.set_updated_at();

create trigger communication_batches_set_updated_at
before update on public.communication_batches
for each row execute function public.set_updated_at();

create trigger communication_messages_set_updated_at
before update on public.communication_messages
for each row execute function public.set_updated_at();

create trigger payment_imports_set_updated_at
before update on public.payment_imports
for each row execute function public.set_updated_at();

create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.can_manage_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() in ('super_admin', 'admin');
$$;

create or replace function public.can_read_country(target_country text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_staff_role() in ('super_admin', 'admin', 'finance', 'communications', 'prayer_team', 'viewer')
    or exists (
      select 1
      from public.staff_country_assignments sca
      where sca.staff_id = auth.uid()
        and sca.country = target_country
    );
$$;

alter table public.profiles enable row level security;
alter table public.staff_country_assignments enable row level security;
alter table public.partners enable row level security;
alter table public.campaigns enable row level security;
alter table public.contributions enable row level security;
alter table public.recurring_commitments enable row level security;
alter table public.partner_notes enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.communication_segments enable row level security;
alter table public.segment_members enable row level security;
alter table public.message_templates enable row level security;
alter table public.communication_batches enable row level security;
alter table public.communication_messages enable row level security;
alter table public.payment_imports enable row level security;
alter table public.payment_import_rows enable row level security;
alter table public.ai_runs enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select_self_or_admin
on public.profiles for select
using (id = auth.uid() or public.can_manage_all());

create policy profiles_admin_all
on public.profiles for all
using (public.can_manage_all())
with check (public.can_manage_all());

create policy staff_country_assignments_admin_all
on public.staff_country_assignments for all
using (public.can_manage_all())
with check (public.can_manage_all());

create policy staff_country_assignments_select_self
on public.staff_country_assignments for select
using (staff_id = auth.uid() or public.can_manage_all());

create policy partners_select_staff
on public.partners for select
using (auth.role() = 'authenticated' and public.can_read_country(country));

create policy partners_insert_staff
on public.partners for insert
with check (public.current_staff_role() in ('super_admin', 'admin', 'finance', 'communications', 'regional_coordinator'));

create policy partners_update_staff
on public.partners for update
using (public.can_manage_all() or assigned_to = auth.uid() or public.current_staff_role() in ('finance', 'communications'))
with check (public.can_manage_all() or assigned_to = auth.uid() or public.current_staff_role() in ('finance', 'communications'));

create policy campaigns_select_staff
on public.campaigns for select
using (auth.role() = 'authenticated');

create policy campaigns_admin_comms_all
on public.campaigns for all
using (public.current_staff_role() in ('super_admin', 'admin', 'communications'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'communications'));

create policy contributions_select_finance_admin
on public.contributions for select
using (public.current_staff_role() in ('super_admin', 'admin', 'finance'));

create policy contributions_finance_all
on public.contributions for all
using (public.current_staff_role() in ('super_admin', 'admin', 'finance'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'finance'));

create policy recurring_commitments_finance_all
on public.recurring_commitments for all
using (public.current_staff_role() in ('super_admin', 'admin', 'finance'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'finance'));

create policy partner_notes_select_staff
on public.partner_notes for select
using (
  public.current_staff_role() in ('super_admin', 'admin', 'finance', 'communications', 'regional_coordinator', 'viewer')
  or (is_sensitive = false and public.current_staff_role() = 'prayer_team')
);

create policy partner_notes_insert_staff
on public.partner_notes for insert
with check (auth.role() = 'authenticated');

create policy prayer_requests_prayer_admin_all
on public.prayer_requests for all
using (public.current_staff_role() in ('super_admin', 'admin', 'prayer_team'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'prayer_team'));

create policy follow_up_tasks_select_staff
on public.follow_up_tasks for select
using (auth.role() = 'authenticated');

create policy follow_up_tasks_staff_write
on public.follow_up_tasks for all
using (auth.role() = 'authenticated' and public.current_staff_role() <> 'viewer')
with check (auth.role() = 'authenticated' and public.current_staff_role() <> 'viewer');

create policy communications_select_staff
on public.communication_segments for select
using (auth.role() = 'authenticated');

create policy communications_write
on public.communication_segments for all
using (public.current_staff_role() in ('super_admin', 'admin', 'communications'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'communications'));

create policy segment_members_select_staff
on public.segment_members for select
using (auth.role() = 'authenticated');

create policy segment_members_comms_write
on public.segment_members for all
using (public.current_staff_role() in ('super_admin', 'admin', 'communications'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'communications'));

create policy message_templates_select_staff
on public.message_templates for select
using (auth.role() = 'authenticated');

create policy message_templates_comms_write
on public.message_templates for all
using (public.current_staff_role() in ('super_admin', 'admin', 'communications'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'communications'));

create policy communication_batches_select_staff
on public.communication_batches for select
using (auth.role() = 'authenticated');

create policy communication_batches_comms_write
on public.communication_batches for all
using (public.current_staff_role() in ('super_admin', 'admin', 'communications'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'communications'));

create policy communication_messages_select_staff
on public.communication_messages for select
using (auth.role() = 'authenticated');

create policy communication_messages_comms_write
on public.communication_messages for all
using (public.current_staff_role() in ('super_admin', 'admin', 'communications'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'communications'));

create policy payment_imports_finance_all
on public.payment_imports for all
using (public.current_staff_role() in ('super_admin', 'admin', 'finance'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'finance'));

create policy payment_import_rows_finance_all
on public.payment_import_rows for all
using (public.current_staff_role() in ('super_admin', 'admin', 'finance'))
with check (public.current_staff_role() in ('super_admin', 'admin', 'finance'));

create policy ai_runs_select_own_or_admin
on public.ai_runs for select
using (user_id = auth.uid() or public.can_manage_all());

create policy ai_runs_insert_self
on public.ai_runs for insert
with check (user_id = auth.uid());

create policy audit_log_select_admin
on public.audit_log for select
using (public.can_manage_all());

create policy audit_log_insert_authenticated
on public.audit_log for insert
with check (auth.role() = 'authenticated');
