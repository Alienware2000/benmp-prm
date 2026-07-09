# User Journeys

> Per-persona end-to-end flows for BENMP PRM: **trigger → screens → server → DB state**. Companion to `srs.md` (the requirements, cited as `FR-N`/`BR-N`) and `api-spec.md` (the route contract). Where a route/table is not built yet, the journey names the phase that lands it (see `phases.md`). Last updated 2026-07-09.

## Personas

Numbered to match `srs.md §3`. Journeys are grouped and numbered per persona (`J1.1`, `J1.2`, …).

1. **Finance staff** — imports statements, reviews payment events, resolves reconciliation, creates contributions.
2. **Communications staff** — approves/sends acknowledgements, runs message batches, manages segments and templates.
3. **Admin / Super admin** — imports partners, configures thresholds/providers/kill-switches, manages roles.
4. **Regional coordinator** — works an assigned region-block follow-up queue (row-level scoping deferred, `FR-1.5`).
5. **Prayer team** — triages prayer requests and care responses.
6. **Viewer / auditor** — reads dashboards and reports only.
7. **AI assistant** — answers and (later) drafts on behalf of the invoking staff user, read-only first (`FR-9.1`).
8. **System (no human)** — provider webhooks and cron jobs that drive the automatic gift-to-relationship pipeline.

Every journey below assumes an authenticated Supabase staff session unless it is a provider webhook or cron path (those authenticate by signature or cron secret, not a session — `api-spec.md §2`).

---

## J8. System: gift arrives via webhook and becomes a thanked relationship

The spine of the product (`srs.md §1`). No human is in the loop until the acknowledgement gate.

### J8.1 Provider webhook → contribution → queued thank-you

**Prereqs**: a payment provider (Paystack Phase 6 / Stripe Phase 2A) is configured with a webhook secret; the partner's phone or provider customer id can be matched (`FR-4.1`).

**Trigger**: a partner gives through a published channel; the provider POSTs to `POST /api/webhooks/{paystack|stripe}`.

1. **Server** reads the **raw** body and verifies the provider signature. Bad signature → **4xx** `BAD_SIGNATURE`, no writes (`FR-3.2`).
2. **Server** parses the payload into a `RawPaymentEvent` and inserts an idempotent `payment_events` row (unique on provider event id). Replay of an already-seen event → **2xx** `DUPLICATE_EVENT`, inert (`FR-3.6`, `NFR-6`).
3. **Server** re-queries the provider transaction to confirm status/amount before promoting (`FR-3.3`). Mismatch → event stays **unpromoted**, no contribution.
4. **Server** matches by normalized phone, then provider customer identity / email / reference words (`FR-4.1`–`FR-4.2`).
   - **Match found** → promote to a `contributions` row (original minor units + currency + provider reference), classify against thresholds, queue an acknowledgement draft.
   - **No/ambiguous match** → event routes to the reconciliation queue (→ **J1.2**); no contribution yet (`FR-4.3`).
5. If the gift crosses the high-touch threshold (default USD 100, `BR-8`) or is above the partner's usual pattern, **Server** creates a priority follow-up task (`FR-6.4`).
6. **Server** returns **2xx**.

**DB state**: `payment_events` (+1, immutable), `contributions` (+1 on match), `communication_messages`/acknowledgement queue (+1 draft), optional `follow_up_tasks` (+1), `audit_log` (+1). Every money-movement step emits a structured log line (provider, event ref, match outcome, status) per AGENTS.md.

**Failure modes**:
- Signature invalid → **4xx**, nothing written beyond a rejected-webhook log.
- Provider verify mismatch → payment event persisted but not promoted; surfaces in reconciliation for a human.
- Contribution is **never** created from a claim/SMS text alone (`BR-2`, `BR-3`).

### J8.2 Recurring invoice cron (Phase 10)

**Trigger**: Vercel Cron hits `POST /api/cron/recurring-invoices` (authenticated by cron secret, not a session).

1. **Server** finds due `recurring_commitments` and, for each, creates one idempotent `invoices` row for the period (unique `(recurring_commitment_id, period_month)`) (`api-spec.md §6`).
2. **Server** issues a prefilled Paystack Charge/Payment-Request, stores `payment_link`, sets status `sent`, and dispatches it through the messaging adapter (consent-checked, `FR-7.4`).
3. Payment, when it lands, arrives as a normal webhook (→ **J8.1**). The invoice is marked `paid` **only** by a verified webhook — never by the cron (`api-spec.md §6`).

**DB state**: `invoices` (+1 per due commitment), `communication_messages` (+1). Re-running the same period is inert.

---

## J1. Finance staff

### J1.1 Statement import → reconciliation

**Prereqs**: finance/admin role; a provider/bank statement CSV (real statements never enter git, `FR-2.6`/`NFR-3`).

**Trigger**: finance uploads a statement on `/giving`.

1. **Screen** `/giving` → upload calls `POST /api/imports/payment-statements/preview` with provider/account type, rows, and date range.
2. **Server** validates rows (Zod), computes row-count / matched / ambiguous / duplicate counts, and returns a preview. Invalid shape → **4xx** `VALIDATION_ERROR` (`api-spec.md §5`).
3. Finance reviews and calls `POST /api/imports/payment-statements/commit`.
4. **Server** creates `payment_events` with source metadata + row dedupe keys (`FR-3.4`); recognized rows promote through the **same** path as webhooks (→ **J8.1**); unknown rows stay in reconciliation (`BR-4`).

**DB state**: `payment_events` (+N), `contributions` (+matched), reconciliation queue (+unmatched), `audit_log` (+1 with import id).

### J1.2 Resolve a reconciliation item

**Trigger**: an unmatched/ambiguous payment event sits in the reconciliation queue (from **J8.1** or **J1.1**).

1. **Screen** `/giving` reconciliation view lists open events.
2. Finance chooses one action (all require finance/admin role, `FR-4.4`):
   - `POST /api/reconciliation/events/:id/match-partner` → links to an existing partner.
   - `POST /api/reconciliation/events/:id/create-partner` → creates a partner, then links.
   - `POST /api/reconciliation/events/:id/dismiss` → requires a reason; **4xx** `VALIDATION_ERROR` if missing.
3. **Server**: match/create promotes to a `contributions` row and queues an acknowledgement (→ **J2.1**); out-of-scope/missing event → **404** `NOT_FOUND`.

**DB state**: `contributions` (+1 on match/create), `partners` (+1 on create), acknowledgement queue (+1), `audit_log` (+1 — every reconciliation action is audited, `FR-4.5`).

### J1.3 Manual finance entry

Finance records a gift seen out-of-band (e.g. cash/transfer). It routes through the **same** payment-event promotion path as webhooks and imports (`FR-3.5`) — never a direct `contributions` insert. **DB state** identical to **J8.1** from step 4.

---

## J2. Communications staff

### J2.1 Approve and send an acknowledgement

**Prereqs**: an acknowledgement draft exists (from **J8.1**/**J1.2**); auto-send stays disabled until the office enables it (`api-spec.md §5`).

**Trigger**: comms opens the acknowledgement queue on `/communication`.

1. **Screen** shows the draft with personalization context: partner name, amount, campaign, giving history, channel (`FR-6.2`).
2. Comms calls `POST /api/acknowledgements/:id/approve`.
3. Comms calls `POST /api/acknowledgements/:id/send`. **Server** checks consent/opt-out **before** dispatch (`FR-7.4`); no consent → send blocked, item flagged. WhatsApp respects template category/approval (`FR-7.5`).
4. Provider status callback (→ **J8**, `POST /api/webhooks/twilio/status`) updates `communication_messages.status` idempotently; failure → `POST /api/acknowledgements/:id/mark-failed` allows retry.

**DB state**: `communication_messages` (status transitions), contribution acknowledgement state updated, `audit_log` (+1).

### J2.2 Run a message batch

**Trigger**: comms builds a segment and a batch on `/communication`.

1. Comms previews the segment, then creates a batch. **Server** requires a **named approver** for any bulk send (`FR-7.3`, `BR-11`); missing approver → **4xx** `FORBIDDEN`.
2. Broadcasts in Bishop Dag's name / prayer broadcasts need an **extra** named approver (`FR-7.6`).
3. Each message dispatches through the adapter with a per-recipient consent check (`FR-7.4`); opted-out recipients are skipped.

**DB state**: message batch (+1), `communication_messages` (+N), `audit_log` (+1 naming the approver). Approval scales by level, not message count (`FR-7.7`).

---

## J3. Admin / Super admin

### J3.1 Import partners from an Excel/CSV export

**Trigger**: admin uploads an office/benmp.com export on `/partners` (or `/admin`).

1. `POST /api/imports/partners/preview` → **Server** normalizes phone numbers (`FR-2.3`), detects likely duplicates by normalized phone/email (`FR-2.4`), and assigns a region block from country defaults (`FR-2.5`, `BR-9`). Returns counts + a country→region summary.
2. Admin reviews (may override region assignments) and calls `POST /api/imports/partners/commit`.

**DB state**: `partners` (+inserted / updated), `audit_log` (+1 with audit id). Real exports are never committed to git (`FR-2.6`).

### J3.2 Change a threshold or toggle a kill-switch

**Trigger**: admin edits settings on `/admin` (Phase 1A).

1. **Server** validates and writes `app_settings` (active-year default USD 60, high-touch USD 100 — configurable, not code, `FR-5.4`–`FR-5.5`, `BR-7`–`BR-8`). Secrets are never exposed to the browser bundle (`FR-11.4`, `NFR-3`).
2. Subsequent classification (**J8.1** step 4/5) uses the new thresholds; USD comparisons use stored numeric USD-equivalents, never JS floats (`NFR-7`).

**DB state**: `app_settings` (updated), `audit_log` (+1). Role changes are likewise auditable (`FR-11.3`, `NFR-4`).

---

## J4. Regional coordinator

### J4.1 Work a region-block follow-up queue

**Trigger**: coordinator opens `/follow-up`.

1. **Screen** lists follow-up tasks. In Phase 1 all active staff see all operational data (`FR-1.4`, `BR-10`); row-level scoping by region block is **schema-ready but deferred** until coordinators are onboarded (`FR-1.5`, srs deferred triggers).
2. Coordinator creates/updates/completes tasks; high-touch tasks (from **J8.1**) surface as priority (`FR-6.4`).

**DB state**: `follow_up_tasks` (status transitions), `audit_log` (+1). When scoping activates, an out-of-region write → **403**, out-of-region read → **404**.

---

## J5. Prayer team

### J5.1 Triage a prayer request

**Trigger**: prayer team opens `/prayer`.

1. **Screen** lists prayer requests with status, sensitivity, owner (`FR-10.3`). Sensitive prayer data has **narrower** access than general contact records (`FR-10.4`); a non-authorized role reading a sensitive item → **404** `NOT_FOUND`.
2. Team records a care response and status; partner link attached where known.

**DB state**: prayer request (updated), `audit_log` (+1 for sensitive access).

---

## J6. Viewer / auditor

### J6.1 Read reports without mutating

**Trigger**: viewer opens `/reports`.

1. **Screen** shows giving/region/campaign reports grouped by region block (`FR-8.2`). Any write/send/import/approve/reconcile route → **403** `FORBIDDEN` (`FR-1.3`).
2. Before month-close snapshots exist, live figures are **labelled live** (`FR-8.4`); after Phase 5, closed months read from frozen snapshots so answers don't drift (`FR-8.3`).

**DB state**: none (read-only).

---

## J7. AI assistant

### J7.1 Ask a month-end question (read-only)

**Trigger**: staff type a question on `/ai` → `POST /api/ai/chat` (Phase 4).

1. **Server** streams a response via the AI SDK; the model is chosen through `src/lib/ai/model-registry.ts` (provider-agnostic, `FR-9.6`).
2. Tools are **read-only** and business-named — `searchPartners`, `getPartnerBrief`, `getRegionStats(month)`, etc. — going through `PrmRepository`, never raw tables (`FR-9.2`). The AI inherits the invoking user's role/scope (`srs §3`).
3. Every run is logged to `ai_runs` (`FR-9.3`). A request to send/mutate/bypass approval, consent, role scope, or audit is **refused** (`FR-9.4`–`FR-9.5`); drafts (later phases) enter the human approval queue → **J2.1**.

**DB state**: `ai_runs` (+1). No mutation of operational tables in Phase 4.

---

## Cross-cutting guarantees

Hold across every journey above (see `srs.md §5–6`, `security.md`):

- **Contributions only from verified `payment_events`** (`BR-2`). No path — webhook, import, manual, AI, claim — creates a contribution any other way.
- **Idempotency & replay-safety** on every provider event, import row, status callback, and cron period (`FR-3.6`, `NFR-6`).
- **Consent before every send**; bulk sends need a named approver; Bishop-Dag/prayer broadcasts need a second (`FR-7.3`–`FR-7.6`, `BR-11`).
- **Money is original minor units + a numeric USD-equivalent**, never JS floating-point for rule decisions (`NFR-7`).
- **Audit on every sensitive action** — money, messages, prayer, AI approvals, imports, reconciliation, roles (`NFR-4`).
- **Provider SDKs stay inside adapters**; pages/tools never import them or touch Supabase tables directly (`NFR-2`, `api-spec.md §4`).
- **AI reads early, drafts later, acts only through approval, never sends directly** (`BR-12`).
- **Error envelope** is uniform (`{ ok:false, error:{ code, message, details } }`) with the codes in `api-spec.md §2`.
