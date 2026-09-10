-- 0011: Switch public.reconciliation from SECURITY DEFINER to SECURITY INVOKER.
--
-- Supabase Advisor flags views with SECURITY DEFINER because they bypass the
-- querying user's RLS policies and instead enforce the view owner's
-- permissions. For a PRM where partner and giving data must be scoped per
-- role, SECURITY INVOKER is the correct default — it ensures the view
-- respects the calling user's RLS policies.
--
-- This migration is idempotent: if the view does not exist (e.g. fresh
-- local dev), it silently skips. If it does exist, it flips the security
-- property without changing the query.

do $$
begin
  -- ALTER VIEW ... SET only works if the view exists; otherwise no-op.
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'reconciliation'
  ) then
    execute 'ALTER VIEW public.reconciliation SET (security_invoker = true)';
    raise notice 'Switched public.reconciliation to security_invoker.';
  else
    raise notice 'View public.reconciliation not found — skipping.';
  end if;
end $$;