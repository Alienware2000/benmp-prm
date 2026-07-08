# API And Integration Specification

> Planned route, server-action, and webhook contract for BENMP PRM. Current app has staff pages and adapter scaffolding; API routes below land phase by phase.

## 1. Status

Current implemented route surface:

- Staff pages under `src/app/**/page.tsx`
- No implemented `src/app/api/**/route.ts` files yet
- Mock data through `PrmRepository`
- Mock messaging adapter

This document defines the target contract so backend work can start without each agent inventing route names and response shapes.

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
| `BAD_SIGNATURE`    | Provider webhook signature failed.                                       |
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
| Payment webhooks         | Provider signature, not staff session.                 |
| Messaging webhooks       | Provider signature or verify token, not staff session. |
| AI chat                  | Supabase staff session.                                |

### Idempotency

Required for:

- Payment provider events.
- Statement import rows.
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

### Statement Import

Candidate route/action:

- `POST /api/imports/payment-statements/preview`
- `POST /api/imports/payment-statements/commit`

Input:

- provider/account type
- CSV file or parsed rows
- statement date range

Output:

- import id
- row count
- matched count
- ambiguous count
- duplicate count
- reconciliation queue links

Rules:

- Commit creates `payment_events`.
- Recognized rows promote through the same path as webhooks.
- Unknown rows remain in reconciliation.

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

## 6. Payment Webhooks

### `POST /api/webhooks/paystack`

Phase: 2A.

Auth: Paystack signature.

Behavior:

1. Read raw request body.
2. Verify `x-paystack-signature` with `PAYSTACK_WEBHOOK_SECRET`.
3. Parse event into `RawPaymentEvent`.
4. Insert idempotent `payment_events` row.
5. Re-query Paystack transaction with `PAYSTACK_SECRET_KEY`.
6. Promote verified event to contribution.
7. Queue acknowledgement draft.
8. Return 2xx for successfully handled duplicate or new event.

Negative behavior:

- Bad signature: 4xx, no promoted writes.
- Provider verify mismatch: event stays unpromoted for review.

### `POST /api/webhooks/stripe`

Phase: 2A.

Auth: Stripe signature.

Events:

- `checkout.session.completed`
- `invoice.paid`

Behavior:

- Verify raw body signature.
- Map one-time and subscription payments into the same payment event shape.
- Promote only verified successful payments.
- Use Stripe event id and payment intent/invoice id for idempotency.

### `POST /api/webhooks/hubtel`

Phase: after Hubtel account approval.

Auth: provider signature per Hubtel docs.

Behavior:

- Same payment event pipeline.
- Designed for Ghana USSD merchant rail.

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
