-- 0006: Rename partner mobile_number to momo_phone_number and tighten phone rules.
--
-- The hub ingestion wizard (Decision 0018) now collects two distinct phones:
-- - momo_phone_number: Ghana mobile money number, validated strictly as a
--   Ghana mobile (national significant number 9 digits starting with 2 or 5).
-- - whatsapp_number: international WhatsApp number, validated loosely as any
--   parseable E.164 value.
--
-- Church remains a free-text partner attribute; hub-scoped church validation is
-- handled by the ingestion wizard against hub_churches, not by the partners table.

-- Historical column name; 0005 already linked hub-ingested partners via hub_id/church_id.
alter table public.partners rename column mobile_number to momo_phone_number;

-- Hub ingest rows also store the second phone so the audit trail is complete.
alter table public.hub_ingest_rows
  add column if not exists whatsapp_phone_e164 text;

-- Phone normalization is enforced in application code (src/lib/phone.ts), not
-- in CHECK constraints, because E.164 parsing and Ghana-prefix rules evolve with
-- office practice. The not-null requirement is intentionally absent: some legacy
-- partners may only have a WhatsApp number.

comment on column public.partners.momo_phone_number is 'Ghana MoMo/mobile number in E.164. Validated as Ghana mobile (02x/05x, 9 NSN digits).';
comment on column public.partners.whatsapp_number is 'International WhatsApp number in E.164. Validated loosely.';
comment on column public.hub_ingest_rows.whatsapp_phone_e164 is 'WhatsApp phone in E.164 captured at ingest time for audit.';
