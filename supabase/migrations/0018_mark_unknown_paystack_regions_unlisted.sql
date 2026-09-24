-- 0018: Do not attribute Paystack donors with no country to Ghana.
-- One-time Paystack exports do not carry a country, and payment-import-created
-- partners were historically defaulted to Ghana. Keep Ghana attribution for a
-- partner that also has a known Ghana MoMo/bank payment; otherwise mark the
-- Paystack-only partner as Unlisted until staff assigns a country.

with paystack_partners as (
  select distinct raw_row ->> 'matched_partner_id' as partner_id
  from public.payments
  where payment_method like 'paystack_%'
    and raw_row ->> 'matched_partner_id' is not null
), partners_with_ghana_payment as (
  select distinct raw_row ->> 'matched_partner_id' as partner_id
  from public.payments
  where coalesce(
      payment_method,
      raw_row ->> '_payment_method',
      raw_row ->> 'source'
    ) in ('mobile_money', 'momo', 'bank_transfer', 'bank', 'ecobank')
    and raw_row ->> 'matched_partner_id' is not null
)
update public.partners as partners
set country = 'Unlisted',
    updated_at = now()
from paystack_partners
left join partners_with_ghana_payment
  on partners_with_ghana_payment.partner_id = paystack_partners.partner_id
where partners.id::text = paystack_partners.partner_id
  and partners.source in ('payment_import_review', 'payment_upload_review')
  and partners.country = 'Ghana'
  and partners_with_ghana_payment.partner_id is null;
