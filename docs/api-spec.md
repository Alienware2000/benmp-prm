# API And Integration Specification

> Planned route, server-action, and webhook contract for BENMP PRM. Current app has staff pages and adapter scaffolding; API routes below land phase by phase.

## 1. Status

Current implemented route surface:

- Staff pages under `src/app/**/page.tsx`
- No implemented `src/app/api/**/route.ts` files yet
- Mock data through `PrmRepository`
- Mock messaging adapter

This document defines the target contract so backend work can start without each agent inventing route names and response shapes.

Decision 0006 (2026-07-09): statement-import endpoints are the backbone; Paystack is dropped from the Ghana plan and §6's Paystack webhook spec is retained only as the reference webhook pattern.

## 2. Conventions

### Response Envelope

Use this shape for JSON API responses:

```json
{
  "ok": true,
  "data": {}
}
```

Error shape:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": {}
  }
}
```

### Error Codes

| Code               | Meaning                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `UNAUTHENTICATED`  | Staff auth required.                                                     |
| `FORBIDDEN`        | Staff role lacks permission.                                             |
| `VALIDATION_ERROR` | Request shape or file row failed validation.                             |
| `BAD_SIGNATURE`    | Messaging-provider webhook signature failed.                             |
| `DUPLICATE_EVENT`  | Provider event or import row already processed. Usually safe/idempotent. |
| `NOT_FOUND`        | Resource missing or hidden by scope.                                     |
| `CONFLICT`         | State transition not allowed.                                            |
| `PROVIDER_ERROR`   | External provider failed or returned inconsistent status.                |
| `INTERNAL_ERROR`   | Unexpected server error.                                                 |

### Auth Modes

| Route Type               | Auth                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Staff pages              | Supabase staff session.                                                               |
| Staff API/server actions | Supabase staff session and role check.                                                |
| CSV payment import       | Supabase staff session and finance/admin role (no provider webhooks — Decision 0007). |
| Messaging webhooks       | Provider signature or verify token, not staff session.                                |
| AI chat                  | Supabase staff session.                                                               |
| Hub-admin pages/API      | Signed hub session cookie (`hub_session`, HMAC, Decision 0018) — see Hub Auth below.  |

### Idempotency

Required for:

- CSV payment import rows.
- Manual gift promotion.
- Message status callbacks.
- Month-close snapshots.

## 3. Staff Pages

| Page             | Current Status                           | Purpose                                           |
| ---------------- | ---------------------------------------- | ------------------------------------------------- |
| `/`              | Implemented with mock/local workspace    | Today operations console.                         |
| `/partners`      | Implemented with mock data               | Partner directory and search.                     |
| `/giving`        | Implemented with mock data               | Contributions, imports, reconciliation readiness. |
| `/communication` | Implemented with mock data               | Segments, batches, provider status.               |
| `/follow-up`     | Implemented with mock data               | Follow-up queues.                                 |
| `/campaigns`     | Implemented with mock data               | Crusade/campaign records.                         |
| `/prayer`        | Implemented with mock data               | Prayer request queues.                            |
| `/reports`       | Implemented with mock data               | Giving/country/campaign reports.                  |
| `/ai`            | Implemented as governance/readiness page | Future AI chat/assistant surface.                 |
| `/admin`         | Implemented with mock data               | Roles, providers, backend readiness.              |

## 4. Repository Contract

Current read methods in `src/lib/data/types.ts`:

- `getOverview()`
- `getPartnersView()`
- `getGivingView()`
- `getCommunicationView()`
- `getFollowUpView()`
- `getCampaignsView()`
- `getPrayerView()`
- `getAiOperationsView()`
- `getAdminView()`

Phase 1B and 2 work should add command methods or server-action modules for:

- Partner import preview/commit.
- Partner create/update.
- Payment event record/promote.
- Statement import preview/commit.
- Reconciliation match/create/dismiss.
- Acknowledgement draft/approve/send.
- Follow-up task create/update/complete.
- Message batch create/approve/send.
- AI tool reads.

Do not let pages import provider SDKs or Supabase tables directly.

## 5. Planned Staff API / Server Actions

The implementation may choose server actions instead of JSON API routes for staff-only actions. The contract still applies.

### Partner Import

Candidate route/action:

- `POST /api/imports/partners/preview`
- `POST /api/imports/partners/commit`

Preview input:

- CSV file or parsed rows.
- Source label, for example `office_excel` or `benmp_com_export`.

Preview output:

- row count
- valid rows
- duplicate candidates
- invalid rows with reasons
- country-to-region assignment summary

Commit output:

- inserted partners
- updated partners
- skipped rows
- audit id

### Payment CSV Import

The **sole money-intake path** (Decision 0007). Staff upload a CSV of payments for a period; matched rows tick partners as paid.

Candidate route/action:

- `POST /api/imports/payment-statements/preview`
- `POST /api/imports/payment-statements/commit`

Input:

- source/account label
- CSV file or parsed rows
- statement period (date range)

Output:

- import id
- row count
- matched count
- ambiguous count
- duplicate count
- reconciliation queue links

Rules:

- Commit creates `payment_events` (source `csv_import`).
- Recognized rows promote to `contributions` through the same path as manual finance entry.
- Unknown/ambiguous rows remain in reconciliation.
- Finance/admin role required; every import writes `audit_log`.

### Reconciliation

Candidate route/action:

- `POST /api/reconciliation/events/:id/match-partner`
- `POST /api/reconciliation/events/:id/create-partner`
- `POST /api/reconciliation/events/:id/dismiss`

Rules:

- All actions require finance/admin role.
- Dismiss requires reason.
- Match/create may promote to contribution and queue acknowledgement.
- All actions write `audit_log`.

### Acknowledgements

Candidate route/action:

- `POST /api/acknowledgements/:id/approve`
- `POST /api/acknowledgements/:id/send`
- `POST /api/acknowledgements/:id/mark-failed`

Rules:

- Sending checks consent.
- Auto-send remains disabled until office explicitly approves it.
- Provider responses update `communication_messages` or contribution acknowledgement state.

## Hub Auth Routes (HP-2, as-built 2026-08-24, Decision 0018)

Live routes on the POC deployment (not the planned Supabase-Auth staff model above). One login door at `/api/login`; the body decides which kind of session is issued.

### `POST /api/login`

- `{ "password" }` — staff: verifies against the shared `POC_PASSWORD`, sets `poc_session`.
- `{ "hubNumber", "password" }` — hub leader: verifies against `hub_accounts` (scrypt), touches `last_login_at`, sets `hub_session` (HMAC-signed stateless cookie, 7 days, secret `HUB_SESSION_SECRET` → fallback `POC_PASSWORD`). Response: `{ ok, mustChange }`. Unknown hub and wrong password return one indistinguishable 401.

### `POST /api/hub/password`

Requires a valid hub session. Body `{ currentPassword, newPassword }`. Current password is re-verified against the database (a stolen cookie alone cannot rotate it). New password: ≥ 8 chars, not the hub number. On success re-issues `hub_session` with `mustChange: false`.

### `PATCH /api/hub/account`

Requires a valid hub session. Body `{ leaderName }` (2-80 chars) — updates the hub's leader/contact display name. The hub number is the identity and is not editable.

### `POST /api/hub/logout`

Clears `hub_session`.

### Ingestion wizard routes (HP-3)

All require a valid hub session; the proxy additionally blocks them while a password change is pending. Validation rules live in `src/lib/hub/ingest.ts` (pure, unit-tested) and run identically in the preview UI and on the server.

- `POST /api/hub/ingest/parse` — multipart upload of one `.xlsx`/`.xlsm`/`.csv` (≤ 8 MB, ≤ 5000 rows/sheet, ≤ 60 columns). Returns `{ fileName, sheets: [{ name, rows: string[][] }] }` — plain text grids for sheet/column picking. Excel cell types (numbers, dates, rich text, formula results) are flattened to display text; an integer phone cell keeps its digits. No writes.
- `POST /api/hub/ingest/check` — `{ phones: string[] }` (E.164) → `{ existing: { [phone]: { hubNumber | null } } }`, so the preview can flag "already in the system for Hub N" before save. Re-checked at submit regardless.
- `POST /api/hub/ingest/submit` — `{ fileName, sheetName, columnMap, rows: [{ rowIndex, raw, name, phone, church, removed }] }`. Client state is untrusted: every non-removed row is re-validated (name ≥ 2 words; phone normalizes to E.164 with Ghana default; church on the hub's list, case/whitespace-insensitive; no duplicate phone in the file or in `partners`). Any flagged row → 400 with per-row issues; nothing is written. Clean → writes batch (draft) → all rows incl. removed (audit) → partners (bulk, `source = 'hub_ingest_<batch>'`, hub/church links) → batch submitted. A retry after partial failure is stopped by the duplicate-phone rule, not by duplicating partners.

### Middleware gate

`src/proxy.ts` + `src/lib/hub/gate.ts` (pure, tested): `/hub/*` and `/api/hub/*` require a valid hub session; a hub session outside `/hub` is redirected into it (never reaches `/poc`); `mustChange` sessions are forced to `/hub/password`; staff cookies grant no hub access and vice versa.

## 6. Payment Intake (CSV-only)

There are **no payment-provider webhooks, no signature verification, and no hosted/prefilled charges** (Decision 0007). All money enters through the **Payment CSV Import** in §5; there is no `/api/webhooks/{paystack,stripe,hubtel}` route and no recurring-invoice cron. "Paid" means a matched `contributions` row exists for the period.

### Pledge management (recurring_commitments)

`recurring_commitments` are **pledge records only** (expected monthly amount) — they drive "who hasn't paid" and the reminder list; they charge no one.

- `POST /api/recurring-commitments` / `PATCH /api/recurring-commitments/:id` — staff (finance/admin) manage a partner's standing pledge (amount, cadence, `day_of_month`, reminder channel, status).
- A pledge's `last_fulfilled_date` is set when a CSV-matched contribution covers the period; there is no invoice and nothing to resend.

## 7. Messaging Webhooks

### `POST /api/webhooks/twilio/status`

Phase: 3.

Auth: Twilio request validation.

Behavior:

- Update `communication_messages.status`.
- Store provider message id and error message if failed.
- Idempotent per provider message id/status.

### `POST /api/webhooks/twilio/inbound`

Phase: 3, claim loop only if triggered.

Auth: Twilio request validation.

Behavior:

- Process STOP/opt-out keywords.
- If claim loop is enabled, parse "I gave" style messages into pending claims.
- Send provisional reply only through approved templates.
- Never create contributions from claims alone.

### Meta Cloud API

Phase: 6 or when verification/templates are ready.

Routes:

- Verification GET route for Meta challenge.
- Inbound/status POST route.

Rules:

- Keep behind the messaging adapter.
- Do not fork business logic from Twilio implementation.

## 8. AI Routes

Candidate route:

- `POST /api/ai/chat`

Phase: 4.

Auth: Supabase staff session.

Rules:

- Streaming response using AI SDK 7.
- Model selected through `src/lib/ai/model-registry.ts`.
- Tools are read-only in Phase 4.
- Log each run to `ai_runs`.
- Refuse mutation/send requests until approval envelope exists.

Initial read-only tools:

- `searchPartners`
- `getPartnerBrief`
- `getRegionStats(month)`
- `getMonthlyCycleStatus(month)`
- `previewSegment(criteria)`
- `summarizeCampaign(id)`

## 9. Pagination And Lists

Heavy lists must accept:

- `page`
- `pageSize`
- `cursor` where cursor pagination is better
- filter object
- sort field and direction

Phase 6 must harden large lists for 40,000 partners. Before Phase 6, avoid loading large production tables into browser memory.

## 10. Validation

Use Zod schemas for:

- Import row parsing.
- Webhook mapped event shapes.
- Reconciliation commands.
- Message drafts/batches.
- AI tool arguments.
- Settings updates.

Provider payload validation happens after signature verification.

## 11. Versioning

No public API versioning is required for the first internal MVP.

When routes become externally consumed by benmp.com or another service, add:

- versioned route namespace or explicit compatibility policy
- request signing
- source system identity
- replay prevention
- integration-specific audit logs

## 12. POC routes (Decision 0008/0009)

Everything under `/api/poc/*` requires the `poc_session` cookie (`src/proxy.ts`); unauthenticated calls get `401`.

### `POST /api/poc/ask`

AI answer over the reconciled period. Body `{ question: string }`.

### `POST /api/poc/send`

Preview or send the **planned** queues (thank-yous, reminders) derived from reconciliation.
Body `{ confirm?: boolean, kind?: "thank_you" | "reminder" | "all", audience?: AudienceKey, … }`. `confirm` falsy → preview only.

`audience` is one of `everyone`, `paid`, `unpaid`, `top`, `consistent`, `new`, `legacy-ghana`. All but `legacy-ghana` resolve from `partners` + reconciliation. **`legacy-ghana`** resolves from `legacy_ghana_contacts` (the archived pre-hub Ghana list, db-schema.md) — it never touches `partners`, ignores the min/max amount filter (those contacts have no giving history), and requires a staff-written message. Opt-outs, dedupe, explicit confirmation and audit logging are the same for it as for every other audience.

`legacy-ghana` additionally **requires** `batch` (1-based, within the plan) on both preview and confirm — the ~11.3k audience is split into fixed 2,000-person batches. Batch boundaries are stable (contacts ordered by id), and members already carrying `last_sent_at` are skipped rather than removed, so a completed batch never reslides into the next one. After a confirmed send, only recipients whose outcome was `sent` get stamped; skips and failures stay eligible for a retry of the same batch.

`channel` selects `whatsapp` (default) or `sms`. SMS applies to every audience path — including the planned thank-you/reminder queues built by `planMessages()` — and strips any attachment, since SMS cannot carry media. On an SMS preview the summary gains `smsCost` (`characters`, `parts`, `creditsPerRecipient`, `creditsTotal`, `unicode`, `charactersUntilNextPart`), priced off the **longest** rendered body so one long `{name}` cannot silently push the run into another part. On an SMS **confirm**, the route calls FlashSMS `/sms/estimate` and returns `400` if the credits needed exceed the account balance — a run that dies halfway on `INSUFFICIENT_CREDITS` leaves the office unable to tell who was reached.

A confirmed send is still capped at `MAX_IMMEDIATE_RECIPIENTS` (2,000). Larger audiences preview fine and are rejected at confirm time — `legacy-ghana` (~11.6k) therefore needs batching before it can be sent in full.

### `POST /api/poc/directory/send`

Preview or send a **staff-composed** message to specific partners chosen in `/poc/directory`.

Body: `{ partnerIds: string[], message: string, confirm?: boolean }`

- `partnerIds` — 1–200 partner UUIDs. Re-read from the database server-side; the request body is never trusted for phone numbers.
- `message` — 1–1000 chars. `{name}` is replaced per recipient with their first name, or `Friend` when the record has no usable name.
- `confirm` — omit/false to **preview** (renders every recipient's exact body, sends nothing); `true` to **send**.

Responses:

```jsonc
// preview
{ "ok": true, "data": { "mode": "preview", "summary": { "total": 2, "sendable": 2, "skippedNoPhone": 0, "optedOut": 0, "direct": 2, "sample": [ { "kind": "direct", "name": "Charles", "to": "+2439...", "body": "Hi Charles, ..." } ] } } }
// send
{ "ok": true, "data": { "mode": "sent", "report": { "total": 2, "sent": 1, "skipped": 1, "failed": 0, "skippedByReason": { "not in allowlist": 1 } }, "audited": true } }
```

Errors: `400` empty selection / empty or over-long message / >200 recipients · `404` no matching partners · `401` no session.

Gates (unchanged from 0008 §6): `opt_outs` is enforced, `BENMP_SEND_ALLOWLIST` restricts real delivery when configured, and every attempt — sent, skipped or failed — is written to `sent_messages`.

### Pages

`/poc` (dashboard) · `/poc/giving` (filterable ledger) · `/poc/messages` (send to one number or selected partners). `/poc/directory` redirects to the selected-partners mode in Messages, and `/poc/giving/test` redirects to the single-number mode. Giving and partner search take their filters as **GET query params** so filtered views remain linkable.

### `POST /api/poc/messages/direct`

Sends one staff-composed WhatsApp message to any valid international number.

Body: `{ idempotencyKey: string, fullName?: string, phone: string, message: string, mediaAssetId?: string }`

The phone is normalized server-side. A real send still requires the staff confirmation in the Messages UI, enforces opt-outs and any configured allowlist, validates the attachment against the active provider, and writes the outcome to `sent_messages`.
