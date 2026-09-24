-- 0019: Use Unknown for partners whose country is not known.
update public.partners
set country = 'Unknown',
    updated_at = now()
where lower(trim(country)) = 'unlisted';
