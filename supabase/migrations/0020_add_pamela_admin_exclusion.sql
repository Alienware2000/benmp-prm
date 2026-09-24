-- 0020: Exclude Pamela Quarshie from giver insight groups.
insert into public.benmp_admins (full_name, role, notes)
select 'Pamela Quarshie', 'Admin', 'Office/admin payment activity; not a giver.'
where not exists (
  select 1
  from public.benmp_admins
  where name_key = 'PAMELA QUARSHIE'
);
