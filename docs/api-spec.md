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

| Route Type               | Auth                                                   |
| ------------------------ | ------------------------------------------------------ |
| Staff pages              | Supabase staff session.                                |
| Staff API/server actions | Supabase staff session and role check.                 |
| CSV payment import       | Supabase staff session and finance/admin role (no provider webhooks — Decision 0007). |
| Messaging webhooks       | Provider signature or verify token, not staff session. |
| AI chat                  | Supabase staff session.                                |

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
