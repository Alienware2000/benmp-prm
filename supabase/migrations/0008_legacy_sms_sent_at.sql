-- Per-channel send markers for the legacy Ghana list.
--
-- `last_sent_at` was set by the 2026-08-30 WhatsApp run (503 recipients, all "queued";
-- the Wali device disconnected mid-run, so delivery for those is not certain). The SMS
-- campaign is a separate campaign on a separate channel and must reach everyone,
-- including those 503 — but the WhatsApp history is still worth keeping.
--
-- So the marker becomes per-channel: last_sent_at stays as the WhatsApp record,
-- sms_sent_at tracks this campaign. Nothing is cleared.

alter table public.legacy_ghana_contacts
  add column if not exists sms_sent_at timestamptz;

create index if not exists legacy_ghana_contacts_sms_sent_idx
  on public.legacy_ghana_contacts (sms_sent_at);

comment on column public.legacy_ghana_contacts.last_sent_at is
  'WhatsApp run of 2026-08-30 (503 recipients). Not used by the SMS campaign.';
comment on column public.legacy_ghana_contacts.sms_sent_at is
  'FlashSMS campaign. Set per recipient as each send is accepted, so an interrupted run resumes without double-sending.';
