# User Journeys

> Per-persona end-to-end flows for BENMP PRM: **trigger → screens → server → DB state**. Companion to `srs.md` (the requirements, cited as `FR-N`/`BR-N`) and `api-spec.md` (the route contract). Where a route/table is not built yet, the journey names the phase that lands it (see `phases.md`). Last updated 2026-07-09.

## Personas

Numbered to match `srs.md §3`. Journeys are grouped and numbered per persona (`J1.1`, `J1.2`, …).

1. **Finance staff** — uploads payment CSVs, reviews payment events, resolves reconciliation, ticks partners as paid.
2. **Communications staff** — approves/sends acknowledgements, runs message batches, manages segments and templates.
3. **Admin / Super admin** — imports partners, configures thresholds/settings/kill-switches, manages roles.
4. **Regional coordinator** — works an assigned region-block follow-up queue (row-level scoping deferred, `FR-1.5`).
5. **Prayer team** — triages prayer requests and care responses.
6. **Viewer / auditor** — reads dashboards and reports only.
7. **AI assistant** — answers and (later) drafts on behalf of the invoking staff user, read-only first (`FR-9.1`).

Every journey below assumes an authenticated Supabase staff session unless it is a messaging-provider callback (those authenticate by signature/verify token, not a session — `api-spec.md §2`). There is **no live payment intake**: money enters only through the CSV import in **J1.1** (Decision 0007).

---

## J1. Finance staff

### J1.1 Payment CSV import → match → tick paid (the product spine)

The core loop (`srs.md §1`, Decision 0007): a CSV of a period's payments becomes matched, ticked, thanked contributions. No human is in the loop for a clean match until the acknowledgement gate.

**Prereqs**: finance/admin role; a period's payment CSV, exported by the office from wherever the money landed (wallet/bank/remittance). Real CSVs never enter git (`FR-2.6`/`NFR-3`).

**Trigger**: finance uploads the CSV on `/giving`.

1. **Screen** `/giving` → upload calls `POST /api/imports/payment-statements/preview` with a source/account label, the rows, and the statement period.
2. **Server** validates rows (Zod) and, for each, attempts a match against the partner DB by normalized phone, then email / reference words (`FR-4.1`–`FR-4.2`). Returns row-count / matched / ambiguous / duplicate / invalid counts. Invalid shape → **4xx** `VALIDATION_ERROR` (`api-spec.md §5`).
3. Finance reviews the preview and calls `POST /api/imports/payment-statements/commit`.
4. **Server** creates immutable `payment_events` (source `csv_import`) with per-row dedupe keys (`FR-3.1`, `FR-3.3`). Re-importing the same row is inert (`FR-3.6`, `NFR-6`).
   - **Matched row** → promote to a `contributions` row (original minor units + currency + date); the partner is now **ticked as paid** for the period, and any covered `recurring_commitments` pledge gets `last_fulfilled_date` set. Classify against thresholds and queue an acknowledgement draft (`FR-6.1`).
   - **Unmatched / ambiguous row** → stays in the reconciliation queue (→ **J1.2**); no contribution yet (`FR-4.3`, `BR-4`).
5. If a gift crosses the high-touch threshold (default USD 100, `BR-8`) or is above the partner's usual pattern, **Server** creates a priority follow-up task (`FR-6.4`).

**DB state**: `payment_imports` (+1), `payment_import_rows` (+N), `payment_events` (+N, immutable), `contributions` (+matched), reconciliation queue (+unmatched), acknowledgement queue (+matched), optional `follow_up_tasks` (+high-touch), `audit_log` (+1 with import id). Every money-movement step emits a structured log line (source, row ref, match outcome, status) per AGENTS.md.

**Failure modes**:
- Invalid CSV shape → **4xx** `VALIDATION_ERROR`, nothing committed.
- Duplicate row on re-import → inert, no second contribution.
- Contribution is **never** created from a claim/SMS text alone (`BR-2`, `BR-3`).

### J1.2 Resolve a reconciliation item

**Trigger**: an unmatched/ambiguous payment event sits in the reconciliation queue (from **J1.1**).

1. **Screen** `/giving` reconciliation view lists open events.
2. Finance chooses one action (all require finance/admin role, `FR-4.4`):
   - `POST /api/reconciliation/events/:id/match-partner` → links to an existing partner.
   - `POST /api/reconciliation/events/:id/create-partner` → creates a partner, then links.
   - `POST /api/reconciliation/events/:id/dismiss` → requires a reason; **4xx** `VALIDATION_ERROR` if missing.
3. **Server**: match/create promotes to a `contributions` row and queues an acknowledgement (→ **J2.1**); out-of-scope/missing event → **404** `NOT_FOUND`.

**DB state**: `contributions` (+1 on match/create), `partners` (+1 on create), acknowledgement queue (+1), `audit_log` (+1 — every reconciliation action is audited, `FR-4.5`).

### J1.3 Manual finance entry

Finance records a gift seen out-of-band (e.g. cash handed in). It routes through the **same** payment-event promotion path as the CSV import (`FR-3.5`) — never a direct `contributions` insert. **DB state** identical to **J1.1** from step 4.

---

## J2. Communications staff

### J2.1 Approve and send an acknowledgement

**Prereqs**: an acknowledgement draft exists (from **J1.1**/**J1.2**); auto-send stays disabled until the office enables it (`api-spec.md §5`).

**Trigger**: comms opens the acknowledgement queue on `/communication`.

1. **Screen** shows the draft with personalization context: partner name, amount, campaign, giving history, channel (`FR-6.2`).
2. Comms calls `POST /api/acknowledgements/:id/approve`.
3. Comms calls `POST /api/acknowledgements/:id/send`. **Server** checks consent/opt-out **before** dispatch (`FR-7.4`); no consent → send blocked, item flagged. WhatsApp respects template category/approval (`FR-7.5`).
4. The messaging provider's delivery-status callback (`POST /api/webhooks/twilio/status`, signature-verified) updates `communication_messages.status` idempotently; failure → `POST /api/acknowledgements/:id/mark-failed` allows retry.

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
2. Subsequent classification (**J1.1** step 4/5) uses the new thresholds; USD comparisons use stored numeric USD-equivalents, never JS floats (`NFR-7`).

**DB state**: `app_settings` (updated), `audit_log` (+1). Role changes are likewise auditable (`FR-11.3`, `NFR-4`).

---

## J4. Regional coordinator

### J4.1 Work a region-block follow-up queue

**Trigger**: coordinator opens `/follow-up`.

1. **Screen** lists follow-up tasks. In Phase 1 all active staff see all operational data (`FR-1.4`, `BR-10`); row-level scoping by region block is **schema-ready but deferred** until coordinators are onboarded (`FR-1.5`, srs deferred triggers).
2. Coordinator creates/updates/completes tasks; high-touch tasks (from **J1.1**) surface as priority (`FR-6.4`).

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

- **Contributions only from verified `payment_events`** (`BR-2`). No path — CSV import, manual, AI, claim — creates a contribution any other way.
- **Idempotency & replay-safety** on every CSV import row and messaging status callback — re-importing a row is inert (`FR-3.6`, `NFR-6`).
- **Consent before every send**; bulk sends need a named approver; Bishop-Dag/prayer broadcasts need a second (`FR-7.3`–`FR-7.6`, `BR-11`).
- **Money is original minor units + a numeric USD-equivalent**, never JS floating-point for rule decisions (`NFR-7`).
- **Audit on every sensitive action** — money, messages, prayer, AI approvals, imports, reconciliation, roles (`NFR-4`).
- **Provider SDKs stay inside adapters**; pages/tools never import them or touch Supabase tables directly (`NFR-2`, `api-spec.md §4`).
- **AI reads early, drafts later, acts only through approval, never sends directly** (`BR-12`).
- **Error envelope** is uniform (`{ ok:false, error:{ code, message, details } }`) with the codes in `api-spec.md §2`.
