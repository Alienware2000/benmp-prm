-- 0024: Amount pledged per partner (Decision 0030).
--
-- RSC Ghana's partner sheets carry an "Amount" column: what each partner has
-- pledged (Paul GTWC, 2026-10-10). It is a commitment, not money received, so it
-- lives on the partner and never in payments or the giving totals. Whether a
-- region collects it is region data, like momo_required (Decision 0026).

alter table public.regions
  add column if not exists collects_pledge boolean not null default false;

update public.regions set collects_pledge = true where code = 'RSC_GHANA';

alter table public.partners
  add column if not exists pledged_amount_minor bigint
    check (pledged_amount_minor is null or pledged_amount_minor >= 0),
  add column if not exists pledge_currency text;

-- Undo:
--   alter table public.partners drop column if exists pledge_currency,
--                               drop column if exists pledged_amount_minor;
--   alter table public.regions drop column if exists collects_pledge;
