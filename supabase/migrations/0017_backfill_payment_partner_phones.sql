-- 0017: Backfill MoMo phones for partners created from payment imports.
-- Payment imports already persist raw_row.matched_partner_id, but older partner
-- records were created without the payer phone. Reconciliation can then only
-- recognize them through the payment link; this backfill restores the contact
-- field without overwriting an existing MoMo or WhatsApp number.

with payment_partner_phones as (
  select distinct on (raw_row ->> 'matched_partner_id')
    raw_row ->> 'matched_partner_id' as partner_id,
    payer_phone_e164
  from public.payments
  where raw_row ->> 'matched_partner_id' is not null
    and payer_phone_e164 is not null
  order by raw_row ->> 'matched_partner_id', paid_at asc nulls last, reference asc
)
update public.partners as partners
set momo_phone_number = payment_partner_phones.payer_phone_e164,
    updated_at = now()
from payment_partner_phones
where partners.id::text = payment_partner_phones.partner_id
  and partners.momo_phone_number is null
  and partners.whatsapp_number is null;
