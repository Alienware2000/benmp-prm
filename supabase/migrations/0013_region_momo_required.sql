-- 0013: MoMo is a Ghana thing (Decision 0026).
--
-- The wizard's strict Ghana-MoMo column exists because giving reconciliation
-- matches partners by MoMo number — a Ghana-specific mechanism. The Africa and
-- Europe regions' partners have no Ghana MoMo wallets, and the partner template
-- their hubs received has no MoMo column, so requiring one made their uploads
-- impossible. Whether a region collects MoMo is now region data, in keeping
-- with "a region is data rather than a fork" (Decision 0020).

alter table public.regions
  add column if not exists momo_required boolean not null default false;

update public.regions set momo_required = true
  where code in ('UD_GHANA', 'UJ_GHANA');
