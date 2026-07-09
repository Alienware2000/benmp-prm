# Delivery Plan

Last updated: 2026-07-08. Companion to `docs/design-spec.md`.

> **How to use this file.** Each phase below has a Goal, Prerequisites, Deliverables, an Acceptance test, and a fenced **AI prompt**. To execute a phase, paste the prompt into your coding agent (Claude Code, Codex, etc.) — the prompts assume the agent can read this whole repo, especially `docs/`. **Every prompt's REQUIRED READING implicitly includes `docs/srs.md` (requirement IDs) and `docs/db-schema.md` (schema contract, incl. §13 planned tables/columns for your phase).** Build phases in order; run each acceptance test before starting the next. If implementation must deviate from the plan, record it as an **"As-built notes (Phase N, date)"** section appended to the end of this file. `supabase/migrations/` is the authoritative schema: if code and schema disagree, the schema wins until deliberately changed. "Working over looking nice" is the standing rule — every phase ends with something the BENMP office can actually use.

## Workstreams

Five workstreams that can be owned by different people (or one person wearing multiple hats early on):

| Workstream | Owns | Key skills |
| --- | --- | --- |
| A. Data & platform | Supabase schema, RLS, auth, roles, imports, audit log | Postgres, Supabase, Next.js server |
| B. Payments | Payment adapters, webhooks, event pipeline, matching, reconciliation | Paystack/Hubtel/Stripe APIs, webhook security |
| C. Messaging | WhatsApp/SMS/email adapters, templates, consent, delivery tracking, claim loop | Twilio/Meta Cloud API, Resend |
| D. AI assistant | Chat surface, tool definitions, approval gates, evals | AI SDK 7, prompt/tool design |
| E. Product & UX | Staff workflows, Today console, reports, onboarding the office team, **frontend consolidation pass** (audit current pages, remove redundant surfaces, improve visual design — runs alongside Phases 1–2, not a rewrite) | Next.js/React, operational UX |

Dependencies between workstreams are deliberately thin: B, C, and D all write into and read from the schema that A owns, through the `PrmRepository` and adapter contracts that already exist.

## The one-week MVP sprint (added 2026-07-08)

Target: a **working MVP in one week**, built AI-assisted using the phase prompts below. The sprint is Phases 1A → 1B → 2B (statements first — the backbone per Decision 0006) → 2A-lite (Stripe) → 4 at trimmed scope, running on **test credentials** (live merchant onboarding is calendar time, not effort time — see Day 0). Phase 3 is reduced to a sandbox demo moment; Phases 5–6 and the deeper agentic goals are explicitly out of the week.

**What "working MVP" means at the end of the week** (the demo, in order):

1. Staff member logs in (real auth, real database).
2. The partner list is real — imported from the office's sheets, phones normalized, region blocks assigned.
3. A MoMo merchant-wallet statement imports and its rows become matched contributions with acknowledgement drafts — the custody-first flow admin chose (Decision 0006) — with the high-touch flag firing above threshold.
4. A test Stripe payment (the text-to-give link rail) appears within a minute via webhook; an unmatched statement row lands in the reconciliation queue and is resolved on screen.
5. The AI assistant answers the five headline questions from the live data, numbers matching /reports.
6. (Nice-to-have flourish) One sandbox WhatsApp thank-you actually delivered to a phone in the room.

**Parallel tracks — built for multiple people (and agents) working simultaneously.** The adapter architecture is what makes this safe: payments and AI can build against fixtures and the **mock repository** from hour one, and swap to Supabase the moment Track A lands it. Each track owns its directories — conflicts are structural, not luck.

| Track | Owner | Builds | Owns (nobody else writes here) |
| --- | --- | --- | --- |
| **A — Platform** | 1 person | 1A then 1B-backend (import pipeline, server actions) | `supabase/migrations/**`, `src/lib/data/**`, `src/lib/supabase/**`, `src/lib/phone.ts`, auth + `src/proxy.ts` |
| **B — Payments** | 1 person | 2A then 2B, against fixtures + mock repo from Day 1 | `src/lib/payments/**`, `src/app/api/webhooks/**`, `src/lib/giving/**`, `fixtures/payments/**` |
| **D — AI** | 1 person | Phase 4 against the mock repo from Day 1 (mock implements `PrmRepository` — the tools don't care) | `src/lib/ai/**`, `src/app/ai/**` |
| **E — Product/UX** | 1 person (or split of A) | UI-audit implementation: nav trim, queue-first Today, empty states, import/reconciliation screens as B/A land their backends | `src/app/*/page.tsx`, `src/components/**` |

**Sync points** (the only moments tracks must coordinate):

- **S1 — end of Day 1: contract lock.** Track A publishes the migration set + any `PrmRepository` additions. After S1, changes to `src/lib/data/types.ts` or migrations go through a quick review by A — everyone else builds against the locked contract.
- **S2 — Day 2: real backend available.** `BENMP_DATA_PROVIDER=supabase` works; Tracks B/D/E flip an env var, nothing else changes.
- **S3 — Day 5: integration.** End-to-end gift flow (webhook → contribution → ack draft → visible in UI → AI can count it). Demo dry-run Day 6.

**Conflict rules**: one branch per track, merge to main at least daily (typecheck + lint green); shared files (`types.ts`, `src/lib/data/index.ts`, `package.json`) are Track A's — others send small PRs; no formatting-only diffs; new deps announced in the team channel before adding.

**Day grid**:

| Day | A — Platform | B — Payments | D — AI | E — UX |
| --- | --- | --- | --- | --- |
| **0** | Supabase + Vercel projects | **Submit MTN MoMoPay merchant application (longest pole)**; Stripe test account | Model API key via registry | Twilio sandbox; request office Excel export |
| 1 | **1A**: schema, repository, auth → **S1** | Adapter contract + statement parsers vs fixtures + mock | Chat UI + tools vs mock repo | Nav trim + queue-first Today shell (vs mock) |
| 2 | **1B**: phone lib, CSV import backend → **S2** | Matching + status rules (unit-tested) | Five headline tools working | Import screen; empty states |
| 3 | Support + review; seed script | Statement import e2e on Supabase; Stripe webhook rail | Partner brief; `ai_runs` logging | Ack queue + reconciliation screens |
| 4 | Today server actions (with E) | **2B**: statement CSV import + reconciliation backend | Golden-question eval vs seed data | Reports per region block |
| 5 | **S3 integration** | S3: webhook → UI proven | S3: AI counts the test gift | S3: demo polish |
| 6 | Deploy to Vercel | Sandbox WhatsApp thank-you (manual trigger fine) | Transcript dry-run | Demo script dry-run |
| 7 | Buffer — overruns land here, not in the demo | | | |

Fewer people? Merge tracks in this order: E folds into A, then D waits until Day 4 (solo order: 1A → 1B → 2A → 2B → 4).

**Explicitly deferred past the week** (say this out loud in the demo so expectations stay honest): live WhatsApp at volume + consent machinery + reminder batches (needs Meta verification and templates), the remittance claim loop, Hubtel USSD (application pending), month-close snapshots (reports compute live for now), sequences, AI drafting/acting/watchdog, regional RLS scoping, call queue, pawaPay. None of these require rework later — the week builds the spine they attach to.

**Sprint rule**: when a phase prompt's scope conflicts with the week, cut scope, not correctness — the invariants in Cross-phase rules are not negotiable, including at demo speed.

## Phase 0 — Mock MVP (done)

What exists today: Next.js 16 app, adapter-first architecture, typed mock repository, all core pages (Today, Partners, Giving, Communication, Follow-up, Campaigns, Prayer, AI, Reports, Admin), Supabase schema draft, docs.

---

## Phase 1A — Supabase foundation: live schema, repository, auth

**Goal**: the app runs against a real Supabase Postgres with staff logins and roles, behind the existing `PrmRepository` contract. No feature changes — same screens, real backend.

**Prerequisites**: Phase 0. A Supabase project and its env keys.

**Deliverables**:

- `supabase/migrations/0002_*.sql`: `region_blocks` lookup (seeded with the seven blocks in db-schema §12) + `partners.region_block_id` + a country→block default mapping; `app_settings` config table holding editable thresholds (active-year 60 USD, high-touch 100 USD) and feature kill-switches; `contributions.usd_equivalent numeric`.
- `src/lib/data/supabase-prm-repository.ts` implementing `PrmRepository`; factory in `src/lib/data/index.ts` switches on `BENMP_DATA_PROVIDER=mock|supabase`.
- Supabase Auth (email/password) for staff; `profiles` rows with `staff_role`; login screen; `src/proxy.ts` protecting all app routes; baseline RLS (authenticated staff read; role-gated writes; **no region scoping yet** — Decision 0004).
- Seed script (staff users + minimal reference data), `npm run db:seed` or documented equivalent.

**Acceptance test**:

1. Fresh database: migrations apply cleanly, seed succeeds, staff user logs in and sees every page rendered from Supabase (`BENMP_DATA_PROVIDER=supabase`).
2. Unauthenticated request to any app route redirects to login.
3. Negative: a `viewer`-role user attempting a write (any server action) is rejected.
4. `BENMP_DATA_PROVIDER=mock` still works; `npm run typecheck && npm run lint && npm run build` pass.

```text
You are implementing Phase 1A (Supabase foundation) of BENMP PRM on top of the existing mock MVP.

REQUIRED READING:
- AGENTS.md — project conventions
- docs/db-schema.md §12 (the exact 0002_foundation_config.sql contract) and §11's flagged RLS gap — resolve it deliberately per decisions.md 0004
- docs/design-spec.md §4 (domain concepts), §9 (architecture, data-access rules)
- docs/decisions.md entry 0004 — Supabase, region blocks, thresholds
- supabase/migrations/0001_initial_schema.sql — authoritative; extend, do not rewrite
- src/lib/data/types.ts — the PrmRepository contract the UI already consumes
- node_modules/next/dist/docs/ — Next.js 16 conventions differ from your training data (proxy.ts, not middleware.ts)

SCOPE:
1. Write supabase/migrations/0002_foundation_config.sql: region_blocks lookup table (uuid id, name, sort order) seeded with the seven blocks in docs/db-schema.md §12; country_region_defaults mapping table; partners.region_block_id FK (nullable, backfilled by country default at import time); app_settings key/value table seeded with active_year_threshold_usd=60, high_touch_threshold_usd=100, auto_send_acknowledgements=false; contributions.usd_equivalent numeric NULL.
2. Implement SupabasePrmRepository in src/lib/data/supabase-prm-repository.ts covering every PrmRepository method, using @supabase/ssr server clients. Keep all Supabase specifics inside this file and src/lib/supabase/.
3. Wire the provider factory in src/lib/data/index.ts to BENMP_DATA_PROVIDER (default mock).
4. Add Supabase Auth: login page, sign-out, profiles table usage per 0001 schema, src/proxy.ts route protection for all app routes except login and future webhook routes (/api/webhooks/*).
5. Baseline RLS: authenticated staff can read all core tables; writes gated by role (viewer read-only). Do NOT implement region scoping.
6. Seed script for two staff users (super_admin, viewer) and reference data.

CONSTRAINTS:
- Do not change any page/component beyond what auth requires — the UI consumes PrmRepository only.
- No provider types outside src/lib/data/ and src/lib/supabase/.
- Service-role key server-only; never expose in client bundles.
- Money columns stay numeric; no JS float arithmetic on amounts.

ACCEPTANCE:
- Fresh-database migrate + seed succeeds; login works; all pages render from Supabase.
- Unauthenticated → redirected. Viewer write attempt → rejected.
- BENMP_DATA_PROVIDER=mock still fully works.
- npm run typecheck && npm run lint && npm run build pass.

Output a PR-style summary of what was created, migration notes, and any TODOs.
```

## Phase 1B — Real partner data in, localStorage out

**Goal**: the office's real partner list lives in the system, and every Today-console action persists to the database.

**Prerequisites**: Phase 1A acceptance. A partner CSV export from the office (Excel sheets / benmp.com).

**Deliverables**:

- Partner CSV import flow (upload → column mapping → normalize → dedup review → commit) with `papaparse`; import batches + `audit_log` entries.
- `src/lib/phone.ts`: E.164 canonicalization (Ghana-aware defaults) used by import and everywhere phones are compared.
- Today console server actions replacing all `localStorage` persistence in `src/components/workspace/today-workspace.tsx`.
- Empty states for pages with no real records.

**Acceptance test**:

1. Import the fixture CSV (`fixtures/partners-sample.csv`, create it): partners appear with normalized phones and region blocks derived from country.
2. Re-importing the same file flags duplicates for review — no silent double-insert.
3. A Today action (record gift, capture partner, assign follow-up) survives logout + a different browser.
4. Negative: malformed rows are surfaced in a rejects list with reasons, not dropped silently.

```text
You are implementing Phase 1B (real partner data + persistent Today console) on top of a passing Phase 1A.

REQUIRED READING:
- docs/design-spec.md §4 (partner concept, matching keys), §12 (success criteria)
- src/components/workspace/today-workspace.tsx — the localStorage behavior you are replacing
- src/lib/data/types.ts — PrmRepository; extend it if import needs new methods (business-oriented names)

SCOPE:
1. Build src/lib/phone.ts: toE164(raw, defaultCountry='GH') handling 0-prefixed Ghana numbers, +233 forms, and 9-digit bare forms; unit-test the variants found in fixtures.
2. Partner CSV import at /partners/import: upload, header mapping UI, preview with per-row validation, dedup detection (existing partner with same E.164 phone or email → flagged for review with merge/skip choice), commit writes partners + an import batch record + audit_log rows.
3. Region block assignment on import via country_region_defaults, manual override allowed on the partner record.
4. Replace every localStorage mutation in the Today workspace with server actions calling the repository; delete the local reset action or repoint it to demo data only under mock provider.
5. Empty states for Partners/Giving/Communication when tables are empty.

CONSTRAINTS:
- Phone comparison ONLY via src/lib/phone.ts — no ad-hoc regex elsewhere.
- Imports must be idempotent-safe: an import batch id ties rows to their run.
- Keep forms server-action based; no new client state libraries.

ACCEPTANCE:
- Fixture CSV imports; duplicates flagged on re-import; rejects listed with reasons.
- Today actions persist across sessions/browsers; viewer role still fenced.
- npm run typecheck && npm run lint && npm run build pass.

Output a PR-style summary including the fixture files added.
```

## Phase 2A — Webhook intake rails (Stripe now; MTN API when granted)

> Decision 0006 note: Paystack was dropped from the Ghana plan; build the adapter contract + Stripe. The Paystack scope below is retained as the reference webhook pattern — implement it only if revived. Ghana's rail is the MTN merchant account via Phase 2B statement imports until MTN API access lands.

**Goal**: a gift through a webhook rail becomes a matched contribution with an acknowledgement draft — the §5 pipeline, live for the two instant channels.

**Prerequisites**: Phase 1B acceptance. Stripe test credentials.

**Deliverables**:

- Payment adapter contract (`src/lib/payments/types.ts`) + factory (`BENMP_PAYMENT_PROVIDER`, mock default preserved).
- Paystack adapter + `src/app/api/webhooks/paystack/route.ts`; Stripe adapter + `src/app/api/webhooks/stripe/route.ts` (one-time + subscription events).
- Immutable `payment_events` ingestion → verification (signature + provider re-query) → matching (E.164 phone → provider customer → email → unmatched) → `contributions` with `usd_equivalent` (rate source: manual/admin-editable FX table for now, pluggable).
- Status rules engine `src/lib/giving/status.ts`: active-year, high-touch (incl. above-usual heuristic), missed-month — thresholds read from `app_settings`.
- Acknowledgement queue: every matched contribution creates a personalized draft; staff mark-sent manually this phase; high-touch gifts also create a priority follow-up task.

**Acceptance test**:

1. Signed Paystack test webhook → payment_event + matched contribution + acknowledgement draft visible in the queue.
2. Replayed webhook → no duplicate contribution. Bad signature → 4xx, logged, nothing written.
3. Stripe test checkout (one-time) and subscription invoice both land as contributions.
4. A gift pushing a partner past the high-touch threshold creates a priority follow-up task.

```text
You are implementing Phase 2A (webhook intake rails) on top of a passing Phase 1B.

REQUIRED READING:
- docs/design-spec.md §5 (the gift pipeline — implement exactly this), §6 (channel model + webhook discipline)
- docs/decisions.md entries 0004 and 0005 — provider selections, merchant-first posture
- supabase/migrations/0001 (payment_events, contributions, follow_up_tasks) + your 0002

SCOPE:
1. Define src/lib/payments/types.ts: PaymentAdapter with verifyAndParseWebhook(request) -> RawPaymentEvent, verifyTransaction(ref), plus a provider registry keyed by BENMP_PAYMENT_PROVIDER. Mock adapter keeps demo flows working.
2. Paystack: webhook route verifies x-paystack-signature (HMAC-SHA512 of raw body with secret), inserts payment_events (raw payload jsonb, dedupe on provider reference — unique index + tolerate 23505), re-queries the verify endpoint before promotion.
3. Stripe: webhook route with stripe signature verification; handle checkout.session.completed and invoice.paid; map to the same RawPaymentEvent shape.
4. Matching in src/lib/payments/match.ts: E.164 phone → provider customer id → email → status 'unmatched'. Matched events promote to contributions with currency, usd_equivalent (fx_rates admin table, gift-date lookup, fallback flag when missing), campaign attribution when present.
5. src/lib/giving/status.ts: recompute partner giving status on new contribution — active-year (USD-equivalent yearly total ≥ setting), high-touch (single gift ≥ setting OR ≥ 3x partner's trailing-median gift), missed-month flags. Pure functions, unit-tested.
6. Acknowledgement queue page: drafts merged from partner name/amount/campaign; mark-sent updates contribution acknowledgement status; high-touch creates priority follow_up_task assigned per admin default.

CONSTRAINTS:
- Webhook routes are excluded from auth proxy but MUST verify provider signatures; raw body handling per Next 16 route conventions (check node_modules/next/dist/docs).
- Contributions are created ONLY from verified payment_events. No other path.
- Provider SDK/types confined to src/lib/payments/<provider>/.
- At-least-once mindset throughout: every step idempotent.

ACCEPTANCE:
- Fixture-signed Paystack webhook → event + contribution + ack draft; replay → no dup; bad signature → 4xx and audit_log row, no writes.
- Stripe one-time + subscription fixtures land as contributions.
- Threshold-crossing gift creates the priority task. Unit tests for match.ts and status.ts pass.
- npm run typecheck && npm run lint && npm run build pass.

Output a PR-style summary with webhook test instructions (curl fixtures included in fixtures/).
```

## Phase 2B — Statement imports and the reconciliation queue

**Goal**: webhook-less money (remittance-to-wallet, bank transfers, manual/cash) enters the same pipeline through imports, and finance has one queue to resolve everything ambiguous.

**Prerequisites**: Phase 2A acceptance.

**Deliverables**:

- Statement import at `/giving/imports`: MoMo-wallet CSV and bank CSV mappings → `payment_events` (source `statement_import`), row-hash dedup, reference-word extraction for bank rows.
- Reconciliation queue at `/giving/reconciliation`: unmatched events with actions — match to partner (search), create partner, dismiss (reason required) — all audited.
- Manual gift entry writing through the same pipeline.

**Acceptance test**:

1. Fixture wallet statement imports: recognizable rows become contributions + ack drafts; strangers land in the queue.
2. Re-importing the same statement adds nothing (row-hash dedup).
3. Queue actions work and write audit_log; dismissal requires a reason.
4. Negative: a manual gift for a nonexistent partner cannot bypass the queue.

```text
You are implementing Phase 2B (statement imports + reconciliation) on top of a passing Phase 2A.

REQUIRED READING:
- docs/design-spec.md §6 channel 3 (wallet + claim loop context — the claim loop itself is Phase 3; you build its statement side)
- docs/decisions.md entry 0005 — why statements are the ledger for wallet money
- Phase 2A code: payment_events ingestion, match.ts — reuse, do not fork

SCOPE:
1. Statement parsers in src/lib/payments/statements/: momo-wallet CSV and bank CSV column mappings (fixtures define the shapes; keep mappings config-driven for new formats). Each row → payment_events with source='statement_import', dedup key = sha256(account, date, amount, reference/narration).
2. /giving/imports: upload → mapping preview → commit; import batches recorded; per-row outcomes (matched / queued / duplicate / rejected) shown after commit.
3. Bank narration parsing: extract the published reference word / phone if present, feed match.ts.
4. /giving/reconciliation: list unmatched payment_events with raw detail; actions: search-and-match partner (then promote to contribution + ack draft), create-new-partner-and-match, dismiss with mandatory reason. Everything writes audit_log.
5. Manual gift entry form routing through payment_events (source='manual') — same promotion path.

CONSTRAINTS:
- One pipeline: statement rows and manual entries promote through the SAME code path as webhooks (match.ts, status.ts, ack queue). No parallel logic.
- Never mutate or delete a payment_event; corrections happen at contribution level with audit trail.

ACCEPTANCE:
- Fixture statement: matched rows → contributions; unknowns → queue; re-import inert.
- Queue match/create/dismiss all function and audit; dismissal without reason blocked.
- npm run typecheck && npm run lint && npm run build pass.

Output a PR-style summary with the fixture statement files added.
```

## Phase 3 — Messaging goes live (+ the remittance claim loop)

**Goal**: the system sends — thank-yous automatically, reminder batches with approval — and inbound WhatsApp opens the claim loop.

**Prerequisites**: Phase 2B acceptance. Twilio sandbox (WhatsApp+SMS) and Resend credentials. Meta Business verification started in parallel (client-side).

**Deliverables**:

- Twilio adapter (WhatsApp + SMS) and Resend email adapter behind the existing messaging contract; delivery-status webhooks → `communication_messages`.
- Per-channel consent/opt-out on partners; template registry with WhatsApp category/approval metadata; opt-out keyword handling on inbound.
- Auto-send acknowledgements after gifts, governed by the `app_settings` kill-switch.
- Monthly reminder batch: segment → merged personalized drafts → staff approval → staggered send with per-message status.
- **Claim loop — trigger-gated** (decisions.md entry 0005): build ONLY if the office reports remittance-app giving is a significant share. When triggered: inbound "I gave"-style WhatsApp messages create pending claims (new `claims` migration), instant provisional thank-you autoreply, auto-match against statement imports, unmatched claims surface in the reconciliation queue.

**Acceptance test**:

1. Test gift → WhatsApp thank-you delivered (sandbox), delivery status recorded; kill-switch off stops auto-send.
2. Reminder batch to a pilot segment requires approval, sends staggered, records per-message status; opted-out partner is excluded (negative test).
3. Inbound claim message → provisional reply + pending claim; the matching statement import confirms it into a contribution; a claim with no statement match after import appears in the reconciliation queue.
4. STOP/opt-out keyword sets the channel consent off and is honored immediately.

```text
You are implementing Phase 3 (live messaging + claim loop) on top of a passing Phase 2B.

REQUIRED READING:
- docs/design-spec.md §7 (messaging rules), §6 channel 3 (claim loop spec)
- docs/decisions.md entry 0005 — claim semantics: claims NEVER create contributions alone
- src/lib/messaging/types.ts + mock-adapter.ts — the contract to implement

SCOPE:
1. TwilioMessagingAdapter (WhatsApp + SMS send, template refs, media-free v1) and ResendEmailAdapter; factory on BENMP_MESSAGING_PROVIDER; delivery-status callback route updating communication_messages.
2. Consent: per-channel boolean + timestamp + source on partners; every send path checks consent; inbound STOP/UNSUBSCRIBE keywords flip consent and confirm.
3. Acknowledgement auto-send: on contribution promotion, if app_settings.auto_send_acknowledgements is true and consent allows, send via preferred channel with fallback WhatsApp→SMS; ack queue remains for review/manual cases.
4. Reminder batches: build from a saved segment, merge templates ({{firstName}} via title-stripping helper, amount, month), approval screen (drafts inspectable), staggered dispatch (rate-limited), per-message status.
5. Claims: migration for claims (partner guess, phone, stated amount, app, raw message, status pending|confirmed|orphaned); Twilio inbound webhook parses free-text gave-messages (amount + intent heuristics, keep permissive), instant provisional autoreply template; matching job ties claims to statement-imported payment_events (phone + amount + date window) on each import; orphaned claims after an import cycle appear in /giving/reconciliation.

CONSTRAINTS:
- No send without consent check; no bulk send without an approval record naming the approver.
- Claims are advisory: contribution creation stays statement/webhook-driven only.
- Provider specifics stay in src/lib/messaging/<provider>/.
- Messages in Bishop Dag's name are out of scope until Phase 5 (do not add a template category for them).

ACCEPTANCE:
- Sandbox thank-you delivered + status tracked; kill-switch respected.
- Batch requires approval; opted-out partner excluded; STOP honored.
- Claim → provisional reply → confirmed by matching import; orphan visible in queue.
- npm run typecheck && npm run lint && npm run build pass.

Output a PR-style summary with sandbox setup notes.
```

## Phase 4 — AI assistant v1 (read-only analyst)

**Goal**: the chatbot the client expects — answering the board's questions from live data, with citations, and zero write capability. Can start in parallel with Phase 3 (needs only Phase 2 data).

**Prerequisites**: Phase 2A acceptance (2B enriches it). Model provider key via the registry.

**Deliverables**:

- `/ai` becomes a real streaming chat (AI SDK 7, model behind `src/lib/ai/model-registry.ts`).
- Read-only tools over the repository: `searchPartners`, `getPartnerBrief`, `getRegionStats`, `getMonthlyCycleStatus`, `previewSegment`, `summarizeCampaign`.
- Every answer cites the numbers used; conversations logged to `ai_runs`; "brief me before the call" button on partner pages.

**Acceptance test**:

1. The five headline questions — partners per block; who paid this month / who hasn't; % active per block; contributions per block; trend vs last month — return answers matching `/reports`.
2. Negative: asking the assistant to send a message or edit a record produces a capability explanation, not an action (no mutation tools exist to call).
3. Every conversation appears in `ai_runs` with tools used.

```text
You are implementing Phase 4 (read-only AI analyst) on top of a passing Phase 2A (2B/3 features enrich answers when present).

REQUIRED READING:
- docs/design-spec.md §8 — capability table (Analyst row) + guardrails
- src/lib/ai/model-registry.ts and src/lib/ai/README.md — provider-agnostic rules
- docs/decisions.md entry 0001 — why v1 is read-only

SCOPE:
1. /ai chat: streaming UI over AI SDK 7 (already a dependency), model resolved via the registry (env-configured; no provider names in business logic), staff-auth required.
2. Tools (zod-schemad, read-only, built on PrmRepository — add repository methods if needed, business-named): searchPartners, getPartnerBrief (profile + giving status + last gifts + open tasks + prayer flags), getRegionStats(month), getMonthlyCycleStatus(month) (paid/unpaid/% active per block), previewSegment(criteria), summarizeCampaign(id).
3. System prompt: staff-facing operations analyst; MUST ground every numeric claim in tool results and show the underlying counts ("42 of 118 UK partners"); refuses actions (no such tools) and says what phase will add them.
4. Log each run to ai_runs (user, messages, tool calls, model id). Partner page "Brief" button pre-fills a getPartnerBrief conversation.

CONSTRAINTS:
- No mutation or send tools of any kind in this phase.
- Tools respect the caller's auth context — no service-role shortcuts.
- Keep answers cheap: tools return aggregates, not row dumps.

ACCEPTANCE:
- Five headline questions match /reports numbers on the same data.
- Action requests are declined with an explanation. Runs logged.
- npm run typecheck && npm run lint && npm run build pass.

Output a PR-style summary with example transcripts.
```

## Phase 5 — Monthly cycle automation + drafting AI

**Goal**: the end-of-month story: the month closes itself, sequences run visibly, and AI drafts messages that staff approve.

**Prerequisites**: Phases 3 and 4 acceptance.

**Deliverables**:

- Month-close job (cron): `monthly_snapshots` per region block (partners, paid, unpaid, % active, totals in USD-equivalent, new, lapsed), frozen on the 1st; `/reports` month view reads snapshots; lapsed partners feed follow-up queues.
- Sequences (visible, pausable): monthly reminders, new-partner welcome, lapsed follow-up, pre-crusade notifications — each step approval-gated where it sends.
- AI drafting tools with approval: `draftPartnerMessage`, segment variants, birthday greetings; **"from the Prophet" prayer broadcasts carry an extra named-approver step**; bulk sends double-confirmed.

**Acceptance test**:

1. Simulated month boundary: snapshot rows match live-computed stats at close time; later data changes don't alter the frozen snapshot.
2. The assistant answers "who paid in [closed month], per region?" from snapshots, matching `/reports`.
3. A sequence can be paused mid-run; resumed run doesn't double-send (idempotent steps).
4. Negative: an unapproved AI draft cannot reach the send pipeline; a Prophet-category draft without the extra approver cannot either.

```text
You are implementing Phase 5 (monthly cycle automation + drafting AI) on top of passing Phases 3 and 4.

REQUIRED READING:
- docs/design-spec.md §5 (the cycle — close semantics), §7 (message governance), §8 ladder step 2
- docs/design-spec.md §8 capability table (Drafter row)

SCOPE:
1. monthly_snapshots migration + close job (Vercel cron route or Supabase scheduled function — pick one, document why): per-block frozen stats; guard against double-close; backfill command for prior months from contributions.
2. /reports month selector reading snapshots for closed months, live computation for the current month, clearly labeled.
3. Lapsed detection at close → follow-up tasks batch (owner routing by region block assignment when present).
4. Sequence engine — trigger-gated: build only when Phase 3's manually-approved batches become the bottleneck (until then, staff run reminder/welcome/lapsed batches by hand from segments). When triggered (simple, DB-backed, inspectable — no external workflow service): definitions for reminder / welcome / lapsed / pre-crusade; steps with send actions require batch approval as in Phase 3; pause/resume; idempotent step execution keyed by (sequence run, partner, step).
5. AI drafting tools registered with an approval envelope: drafts land in a review queue with diff-style preview; approving routes into the existing send pipeline. Template category 'prophet' requires a second distinct approver (role-gated) before it can be approved.

CONSTRAINTS:
- Snapshots are immutable after close; corrections create adjustment records, never edits.
- AI tools still cannot send: they produce drafts that enter the SAME approval pipeline humans use.
- Sequence engine must survive restarts (state in DB, steps idempotent).

ACCEPTANCE:
- Simulated close freezes correct stats; assistant reads them; pause/resume without double-send.
- Unapproved and single-approved prophet drafts blocked from sending.
- npm run typecheck && npm run lint && npm run build pass.

Output a PR-style summary including cron configuration notes.
```

## Phase 6 — Scale and hardening

**Goal**: comfortable at 40,000 partners, multi-staff, and ready for regional coordinators.

**Prerequisites**: Phase 5 acceptance.

**Deliverables**:

- Region-scoped RLS for coordinators (assignments enforced; out-of-scope write → 403, read → 404) + admin UI for assignments.
- 40k-partner seed load test; pagination/virtualization on heavy lists; query/index passes.
- Call-queue workflow (scripts, outcomes, priority ordering by attention tier).
- Provider resilience: webhook retry/replay tooling, dead-letter review; Meta Cloud API adapter evaluation (swap or dual-run vs Twilio); pawaPay adapter if rest-of-Africa volume justifies (Decision 0005 earmark).
- Audit coverage review; backup/restore drill documented.

**Acceptance test**:

1. Seeded 40k partners: partner list, reports, and month close remain responsive (define and record budgets, e.g. p95 < 2s server render on the list).
2. A scoped coordinator is fenced exactly (403 write / 404 read out of scope); all-staff roles unaffected.
3. A replayed historical webhook batch causes zero duplicate contributions.
4. Restore drill from backup succeeds on a scratch project, documented step-by-step.

```text
You are implementing Phase 6 (scale + hardening) on top of a passing Phase 5.

REQUIRED READING:
- docs/design-spec.md §9 (data access), §12; docs/decisions.md entry 0005 (pawaPay earmark)
- Existing RLS policies from Phase 1A — you are extending, not rewriting

SCOPE:
1. Region scoping: staff_country_assignments-driven RLS for regional_coordinator role; repository honors scope; admin UI for assignments; ESLint rule or lint check banning direct table access that bypasses the repository in app code.
2. Load: seed script generating 40k realistic partners + 18 months of contributions; add pagination/virtualization where lists render unbounded; add missing indexes found under load; record measured budgets in this file as as-built notes.
3. Call queue: /follow-up call mode ordering by attention tier + due date, with script display, outcome capture, next-action scheduling.
4. Ops: webhook dead-letter table + replay tool (idempotency makes replay safe); document and run a backup/restore drill; audit-log coverage checklist against design-spec §9 security notes.
5. Evaluate Meta Cloud API adapter behind the messaging contract (build if verification is complete); build pawaPay adapter only if the office confirms rest-of-Africa volume warrants it.

CONSTRAINTS:
- No behavior change for non-coordinator roles.
- Performance work must not fork data paths — optimize inside the repository.

ACCEPTANCE:
- 40k seed within budgets; coordinator fenced (403/404 exact); replay-safe webhooks; restore drill documented.
- npm run typecheck && npm run lint && npm run build pass.

Output a PR-style summary with measured performance numbers.
```

---

## Cross-phase rules (invariants every phase must honor)

- `supabase/migrations/` is authoritative. Schema changes ship as new migrations, updated in the same PR as the code, reflected in `docs/design-spec.md` when they change the domain model.
- Contributions come only from verified `payment_events` (webhook or import). No SMS parsing, ever. Claims are advisory.
- Money: original currency + `usd_equivalent`; numeric/decimal end-to-end; no JS float arithmetic on amounts.
- Provider specifics live inside adapters (`src/lib/payments/<provider>/`, `src/lib/messaging/<provider>/`, `src/lib/data/`); UI and business logic import contracts only.
- Every outbound send passes consent checks; bulk sends require a recorded approver; prophet-category requires two.
- AI may read and draft; it may not send or mutate without the human approval pipeline. All runs logged.
- Sensitive actions write `audit_log`. No secrets, tokens, or real partner data in git.
- `npm run typecheck && npm run lint && npm run build` green at every phase boundary.
- Deviations recorded as **"As-built notes (Phase N, date)"** appended below.

## Sequencing summary

```
1A ──► 1B ──► 2A ──► 2B ──► 3 ──► 5 ──► 6
               └────► 4 (parallel from 2A) ──┘
```

## Standing decisions needed from BENMP (blockers by phase)

- Phase 1: the office's partner Excel sheets + a benmp.com export for the clean import; who are the initial staff users and roles; office confirmation of the region-block list.
- Phase 2: BENMP registered-business documents for the **MTN MoMoPay merchant application (submit Day 0 — longest pole)**; per-region bank accounts + reference-word convention; which legal entity/bank Stripe settles to; daily statement access (CSV/API) for the merchant wallet, council wallets (if federated), and bank accounts.
- Phase 3: WhatsApp Business account ownership and Meta Business verification (weeks — start at Phase 1); sender identity ("BENMP Office"); what share of current giving arrives via remittance apps (decides the wallet channel's marketing weight).
- Phase 5: sign-off on message tone/templates, especially anything sent in Bishop Dag's name, and who the second approver for prophet-category messages is.
