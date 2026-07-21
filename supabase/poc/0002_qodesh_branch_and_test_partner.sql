-- Qodesh branch backfill + the send-test partner.
-- Apply via the Supabase SQL Editor. Idempotent: safe to run more than once.
--
-- Context: partners holds two populations. 14,401 rows carry a real branch in
-- `church`; the remaining 927 (source = 'qodesh_registration') carried null.
-- Those 927 ARE the Qodesh branch, so giving from them was landing unattributed.

begin;

-- 1. The 927 Qodesh registrants get their branch.
--    Scoped by source, not just "church is null", so no other cohort can be caught.
update public.partners
   set church = 'Qodesh',
       updated_at = now()
 where source = 'qodesh_registration'
   and church is null;

-- 2. Test partner — the only number we send to while the send path is being proven.
--    NOTE: +243 is DR Congo. Every other partner phone in this table is +233 (Ghana).
--    Confirm this number before enabling real sends.
insert into public.partners (full_name, whatsapp_number, church, country, status, source, preferred_communication_method)
select 'Charles Djabatey', '+243989426841', 'Qodesh', 'Ghana', 'new', 'send_test', 'whatsapp'
 where not exists (
   select 1 from public.partners where whatsapp_number = '+243989426841'
 );

commit;

-- Verification — expect qodesh = 928 (927 backfilled + the test partner), null_branch = 0.
select
  count(*) filter (where church = 'Qodesh') as qodesh,
  count(*) filter (where church is null)    as null_branch,
  count(*)                                  as total
from public.partners;
