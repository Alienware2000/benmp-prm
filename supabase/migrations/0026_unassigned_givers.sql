-- 0026: Unassigned givers — people with giving on record who belong to no hub.
--
-- Hub admins claim them from the hub portal's "Unclaimed givers" tab (Decision 0033).
-- The view gathers, per hub-less partner with at least one successful payment, what a
-- hub needs to recognise them: last gift date, number of gifts, and the most recent
-- payer notes (MTN "To message", Ecobank "Narration"). The app masks the phone to its
-- last 3 digits before anything reaches the browser.
--
-- Payments link to partners through raw_row->>'matched_partner_id' (set on every
-- import); the expression index makes that join and the hub dashboard's lookups an
-- index scan instead of a full read of payments.

begin;

create index if not exists payments_matched_partner_id_idx
  on public.payments ((raw_row->>'matched_partner_id'));

create or replace view public.unassigned_givers
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  coalesce(p.momo_phone_number, p.whatsapp_number) as phone,
  p.country,
  max(pay.paid_at) as last_gift_at,
  count(*) as gift_count,
  (array_agg(
     coalesce(nullif(trim(pay.raw_row->>'To message'), ''), nullif(trim(pay.raw_row->>'Narration'), ''))
     order by pay.paid_at desc
   ) filter (
     where coalesce(nullif(trim(pay.raw_row->>'To message'), ''), nullif(trim(pay.raw_row->>'Narration'), '')) is not null
   ))[1:5] as recent_notes
from public.partners p
join public.payments pay
  on pay.raw_row->>'matched_partner_id' = p.id::text
 and pay.status = 'Successful'
where p.hub_id is null
group by p.id;

-- Server-only (service role). Nothing in the browser reads this view directly.
revoke all on public.unassigned_givers from anon, authenticated;

commit;

-- Undo:
--   begin;
--   drop view public.unassigned_givers;
--   drop index public.payments_matched_partner_id_idx;
--   commit;
