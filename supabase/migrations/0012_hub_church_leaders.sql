-- 0012: branch pastors on churches (Decision 0025).
-- The Africa/Europe region submissions arrived as per-branch pastor lists
-- (name + WhatsApp), so a church can carry its leader's contact. Additive;
-- UD/UJ churches simply have these as NULL until the office supplies them.

alter table public.hub_churches
  add column if not exists leader_name text,
  add column if not exists leader_phone text;
