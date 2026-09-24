-- 0016: Add payment_method column to payments table for tracking giving source.
-- Values: mobile_money, bank_transfer, paystack_card, paystack_mobile_money,
--         paystack_bank_transfer, paypal, cash, check, other

alter table public.payments
  add column if not exists payment_method text default null;