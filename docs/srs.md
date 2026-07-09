# Software Requirements Specification

> Requirements lock file for BENMP PRM. Source docs: `docs/README.md`, `docs/design-spec.md`, `docs/delivery-plan.md`, `docs/decisions.md`, and `supabase/migrations/0001_initial_schema.sql`. Last updated 2026-07-08.

## 1. Purpose And Scope

BENMP PRM is a staff-only Partner Relationship Management system for the BENMP office and Healing Jesus Campaign. It is not a public donor portal. Partners give through published payment channels and communicate through WhatsApp, SMS, email, or phone; staff use this internal workspace to manage the relationship.

The system exists to turn every verified gift into a reliable partner relationship record:

1. Receive a giving signal.
2. Verify the signal.
3. Match it to a partner or send it to reconciliation.
4. Create a contribution.
5. Queue a thank-you.
6. Classify giving status.
7. Trigger follow-up where needed.
8. Report the month by region block.
9. Let AI answer and draft from trusted data, with human approval before mutation or sending.

### In Scope

- Staff authentication and role-aware access.
- Partner records and clean CSV imports.
- Payment event intake through backend CSV payment imports and manual finance entry (no live payment provider — Decision 0007).
- Contribution creation only from verified `payment_events`.
- Reconciliation for unmatched or ambiguous money.
- Acknowledgement drafts and follow-up tasks.
- Partner messaging through adapter-backed WhatsApp, SMS, and email providers.
- Prayer request tracking.
- Crusade/campaign records and giving attribution.
- Monthly cycle reporting by configurable region blocks.
- Read-only AI analyst in the first live phase, expanding later to drafts and approved actions.
- Audit logging for sensitive operations.

### Out Of Scope For The First Live MVP

- Public partner login.
- A replacement for the public BENMP website.
- Live payment provider integration — webhooks, hosted/prefilled charges, recurring auto-debit (removed; CSV import is the sole money intake — Decision 0007).
- Payment card storage.
- SMS parsing as a money ledger.
- Fully autonomous AI messaging.
- High-volume WhatsApp production sending before sender verification, templates, and consent controls are in place.
- Regional coordinator row-level scoping before coordinators are actually onboarded.
- Reintroducing any live payment rail before the office asks for in-app instant confirmation over CSV reconciliation.

## 2. Glossary

| Term                  | Meaning                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Partner               | A person or organization connected to BENMP through giving, prayer, communication, or crusade support.                           |
| Payment event         | Immutable intake record for money-like input from a CSV payment import or manual finance entry.                                  |
| Contribution          | Verified gift record promoted from a payment event.                                                                              |
| Reconciliation        | Staff workflow for matching unknown or ambiguous payment events to partners.                                                     |
| Acknowledgement       | Thank-you message or call task created after a gift.                                                                             |
| High-touch            | Donor attention tier for gifts above threshold or above normal giving pattern.                                                   |
| Active yearly partner | Partner whose annual USD-equivalent giving covers the configured yearly threshold.                                               |
| Region block          | Configurable reporting group: Ghana, Rest of Africa, Europe, UK, America, South America, Australia/Asia, pending office confirmation. |
| Monthly cycle         | Remind, receive, acknowledge, close, and report for a given month.                                                               |
| Claim loop            | Deferred WhatsApp/SMS flow where a partner says "I gave"; it helps identity matching but never creates a contribution by itself. |
| Provider adapter      | Isolated integration boundary for data, payments, messaging, or AI models.                                                       |
| Approval envelope     | Structured human approval record required before AI draft/actions mutate records or send messages.                               |

## 3. Personas And Roles

| Persona / Role       | Goal                                                                                    | Access                                                               | Cannot                                                        |
| -------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| Super admin          | Configure the system, users, providers, thresholds, and safety controls.                | All operational data and settings.                                   | Bypass audit requirements or expose secrets to client code.   |
| Admin                | Manage normal staff operations and oversee queues.                                      | Broad read/write except secrets.                                     | Bypass provider verification, consent, or approval rules.     |
| Finance staff        | Import statements, review payment events, create contributions, resolve reconciliation. | Giving, partners needed for matching, payment imports, reports.      | Send bulk communications without communications approval.     |
| Communications staff | Manage segments, templates, message batches, acknowledgements, and updates.             | Partner contact data, segments, batches, templates, delivery status. | Create contributions outside verified payment event pipeline. |
| Prayer team          | Review prayer requests and care responses.                                              | Prayer queue and approved partner care context.                      | See finance-only data unless separately authorized.           |
| Regional coordinator | Work assigned partner/follow-up queues for a region block.                              | Designed for future scoped access by region block.                   | See all regions once region scoping is activated.             |
| Viewer / auditor     | Read operational dashboards and reports.                                                | Read-only views appropriate to role.                                 | Write, send, import, approve, or reconcile.                   |
| AI assistant         | Answer, draft, and later propose actions for staff.                                     | Inherits invoking staff user's role and repository scope.            | Send messages, mutate data, or bypass RLS/consent/audit.      |

## 4. Functional Requirements

### FR-1 Staff Authentication And Roles

- FR-1.1 The system MUST require staff authentication before staff pages are accessible.
- FR-1.2 Staff users MUST have a role from `staff_role`.
- FR-1.3 A `viewer` MUST be read-only.
- FR-1.4 Phase 1 access MUST allow all active staff to read core operational data unless a table is explicitly finance/prayer/admin scoped.
- FR-1.5 Region-scoped visibility MUST be supported by schema design and deferred until regional coordinators onboard.
- FR-1.6 Service-role credentials MUST be server-only.

### FR-2 Partner Records And Import

- FR-2.1 The system MUST store partner profile fields needed for BENMP relationship management: name, phone, WhatsApp, email, country, city, church, partner since date, partnership level, giving frequency, preferred communication method, birthday, notes, prayer context, owner, tags, and status.
- FR-2.2 The system MUST support clean CSV import from office Excel exports and benmp.com exports.
- FR-2.3 Imports MUST normalize phone numbers before matching or insert.
- FR-2.4 Imports MUST detect likely duplicates by normalized phone and email.
- FR-2.5 Imports MUST assign a region block from country defaults, with staff override.
- FR-2.6 Real partner exports and statements MUST NOT be committed to git.

### FR-3 Payment Event Intake

Intake is CSV-only; there is no live payment provider (Decision 0007).

- FR-3.1 Every giving signal MUST create or reference a `payment_events` row (source `csv_import` or `manual`) before a contribution is created.
- FR-3.2 A CSV payment import MUST be validated (parsed, typed, currency/amount checked) before any row is written.
- FR-3.3 CSV imports MUST create payment events with source metadata (import id, provider/account label, statement period) and a per-row dedupe key.
- FR-3.4 A two-step preview → commit MUST show matched, ambiguous, duplicate, and invalid row counts before the operator commits.
- FR-3.5 Manual finance entry MUST route through the same payment event promotion path as CSV imports.
- FR-3.6 Re-importing the same CSV row MUST be idempotent (no duplicate payment event or contribution).

### FR-4 Matching And Reconciliation

- FR-4.1 The system MUST attempt matching by normalized phone first.
- FR-4.2 The system SHOULD then use provider customer identity, email, and reference words where available.
- FR-4.3 Ambiguous or unmatched events MUST go to a reconciliation queue.
- FR-4.4 Staff MUST be able to match an event to an existing partner, create a new partner, or dismiss with a reason.
- FR-4.5 Reconciliation actions MUST write audit log entries.

### FR-5 Contributions And Giving Status

- FR-5.1 Contributions MUST only be created from verified payment events.
- FR-5.2 Contributions MUST store original amount, original currency, payment method, provider, provider reference, donor display fields, status, acknowledgement status, attention tier, and campaign where known.
- FR-5.3 The system MUST calculate or store USD-equivalent values for threshold rules once USD-equivalent computation lands (Phase 2).
- FR-5.4 The active yearly threshold MUST be configurable and currently defaults to USD 60.
- FR-5.5 The high-touch threshold MUST be configurable and currently defaults to USD 100.
- FR-5.6 A gift that crosses active-year or high-touch thresholds MUST update visible status and/or create follow-up work.

### FR-6 Acknowledgements And Follow-Up

- FR-6.1 A verified contribution MUST create an acknowledgement draft or queue item.
- FR-6.2 Acknowledgements MUST include enough context for personalization: partner name, amount, campaign, giving history, and channel.
- FR-6.3 Staff MUST be able to approve, send, retry, or mark acknowledgements as failed.
- FR-6.4 High-touch gifts MUST create priority follow-up tasks.
- FR-6.5 Lapsed or missed-month partners SHOULD create gentle follow-up tasks during monthly cycle phases.

### FR-7 Messaging And Consent

- FR-7.1 Messaging MUST use a provider adapter, starting with mock and later Twilio/Meta Cloud API/Resend.
- FR-7.2 Each outbound message MUST know channel, recipient, body, category, partner, template, and provider status where available.
- FR-7.3 Bulk sends MUST require a named staff approver.
- FR-7.4 Each send MUST check consent and opt-out rules before dispatch.
- FR-7.5 WhatsApp production sends MUST respect template category and provider approval requirements.
- FR-7.6 Prayer broadcasts or messages sent in Bishop Dag's name MUST require an extra named approver.
- FR-7.7 Approval MUST scale by level, not by message count: one approval covers one batch (any size); recurring batches MAY later be covered by an approved policy (template + segment + cadence approved once, runs proceed automatically) with automatic re-approval triggers (template change, category change, segment size deviating sharply from the approved run, or a paused kill switch). Policy-level approval is trigger-gated: build it only when per-batch approval becomes the operational bottleneck.

### FR-8 Monthly Cycle And Reports

- FR-8.1 The product loop MUST support reminders, gifts, acknowledgements, close, and reporting.
- FR-8.2 Reports MUST group by region block.
- FR-8.3 Phase 5 MUST add month-close snapshots so closed-month answers do not drift after corrections.
- FR-8.4 Before snapshots exist, reports MAY compute live values but MUST label them as live.
- FR-8.5 The system MUST answer month-end questions: who gave, who did not, active percentage, totals, new partners, lapsed partners, and high-touch gifts.

### FR-9 AI Assistant

- FR-9.1 The first AI assistant MUST be read-only.
- FR-9.2 AI tools MUST use `PrmRepository` and business-named operations, not direct table access from prompts.
- FR-9.3 AI runs MUST be logged in `ai_runs`.
- FR-9.4 AI drafts MUST enter human approval queues before any send or mutation.
- FR-9.5 AI MUST refuse requests to bypass approval, consent, role scope, or audit logging.
- FR-9.6 Model choice MUST be configuration-driven and provider-agnostic.

### FR-10 Campaigns, Prayer, And Partner Care

- FR-10.1 Campaigns/crusades MUST support country, city, date range, funding goal, raised amount, report summary, and public URL.
- FR-10.2 Contributions SHOULD attach to campaigns when the gift supports a specific crusade.
- FR-10.3 Prayer requests MUST be tracked with status, sensitivity, owner, response, and partner link where known.
- FR-10.4 Sensitive prayer data MUST have narrower access than general partner contact records.

### FR-11 Administration And Settings

- FR-11.1 Admin users MUST be able to manage thresholds through `app_settings` once Phase 1A lands.
- FR-11.2 Admin users MUST be able to see provider readiness and configure feature kill switches.
- FR-11.3 Staff role changes MUST be auditable.
- FR-11.4 Provider settings and secrets MUST never be exposed to browser bundles.

## 5. Non-Functional Requirements

| ID     | Requirement                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1  | The MVP MUST work with mock data and later Supabase without rewriting UI pages.                                                     |
| NFR-2  | Provider SDKs MUST remain inside adapter directories.                                                                               |
| NFR-3  | No payment card data, API keys, provider tokens, real partner exports, statements, or private account numbers may be committed.     |
| NFR-4  | Staff actions touching money, messages, prayer, AI approvals, imports, reconciliation, or roles MUST be auditable.                  |
| NFR-5  | Phase 6 MUST support 40,000 partners with pagination, indexing, and no massive unbounded list rendering.                            |
| NFR-6  | CSV import processing MUST be idempotent and replay-safe — re-importing the same row is inert.                                      |
| NFR-7  | Money MUST avoid JavaScript floating-point arithmetic for rule decisions.                                                           |
| NFR-8  | Partner-supplied text MUST be treated as untrusted input in AI prompts and message drafts.                                          |
| NFR-9  | Staff pages SHOULD be usable on laptop and tablet/mobile widths, with operational workflows prioritized over decorative dashboards. |
| NFR-10 | The system MUST preserve an exit path from Supabase by keeping business logic in repository and adapter layers.                     |

## 6. Business Rules

| ID    | Rule                                                                                      |
| ----- | ----------------------------------------------------------------------------------------- |
| BR-1  | Partners do not log in during the first product.                                          |
| BR-2  | Contributions only come from verified `payment_events`.                                   |
| BR-3  | SMS parsing is permanently rejected as the money ledger.                                  |
| BR-4  | Statement imports are first-class intake for wallet, remittance, and bank-transfer money. |
| BR-5  | The monthly reminder loop — never an auto-debit — is the recurring mechanism; partners give and the office reconciles by CSV. |
| BR-6  | `recurring_commitments` are pledge records (expected monthly amount) used to flag who has not yet paid; they do not charge anyone. |
| BR-7  | USD 60 annual giving marks active-year coverage unless changed in settings.               |
| BR-8  | USD 100 or above-usual giving triggers high-touch attention unless changed in settings.   |
| BR-9  | Region blocks are configurable lookup records, not hard-coded enum values.                |
| BR-10 | All staff see all initially; regional scoping is deferred but schema-ready.               |
| BR-11 | Bulk sends require named human approval.                                                  |
| BR-12 | AI may read early, draft later, act only through approval, and never send directly.       |
| BR-13 | Public donor experiences stay separate unless a later bridge is explicitly designed.      |
| BR-14 | benmp-app.vercel.app exposed partner PII as of 2026-07-08 and must not be copied as-is.   |

## 7. Example AI Questions

- Who gave this month by region block?
- Which partners have not given in the current month?
- Which gifts crossed the high-touch threshold this week?
- Which partners in Ghana need a call today?
- Give me a brief for this partner before I call them.
- Draft a thank-you for this partner, but do not send it.
- Which statement import rows still need reconciliation?
- Which crusade has the largest funding gap?
- Summarize prayer requests that need a response, respecting my role.

## 8. Assumptions

- Supabase is the first live backend, behind the repository adapter.
- Vercel is the first web host.
- No live payment provider is integrated; money is reconciled from a periodic CSV the office already exports per period (Decision 0007).
- Twilio is the pilot messaging provider; Meta Cloud API remains the long-term direct WhatsApp path.
- Region blocks are Ghana, Rest of Africa, Europe, UK, America, South America, Australia/Asia until the office confirms otherwise.
- The office can provide partner exports and periodic payment CSVs for import testing.

## 9. Deferred Triggers

| Feature                       | Trigger                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Live payment rail             | Office wants money to land in-app with instant confirmation instead of periodic CSV reconciliation (Decision 0007). |
| WhatsApp claim loop           | Office confirms partners messaging "I gave" would meaningfully speed CSV-row identity matching.         |
| Sequence engine               | Manually-approved message batches become the bottleneck.                                                |
| Month-close snapshots         | Phase 5 starts or reports need frozen historical answers.                                               |
| Regional row-level scoping    | Regional coordinators are onboarded with real ownership boundaries.                                     |
| Meta Cloud API direct adapter | Meta Business verification and WhatsApp templates are approved.                                         |
