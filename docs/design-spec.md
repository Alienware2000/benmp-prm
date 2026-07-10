# BENMP PRM — Design Specification

> The deep-reference companion to `srs.md` (the *how* behind the *what*). **Don't read it cover-to-cover** — for the 5-minute version read `docs/README.md`, for what to build read `docs/phases.md`. Come here when your work needs the detail, via the map below. Last updated 2026-07-08.

Use this map:

| Your work | Read |
| --- | --- |
| Anything (orientation) | §2 product definition, §5 the monthly cycle |
| Payments / intake | §5, §6 |
| Messaging | §7 |
| AI | §8 |
| Schema / platform | §4, §9 |
| Frontend | §9 + Appendix A |
| "Why is it like this?" | §13 + `docs/decisions.md` |

Section numbers are stable — the delivery-plan prompts cite them. Earlier deep-context docs live in `docs/archive/`.

## 1. Why this exists

BENMP (the monthly partnership arm of Bishop Dag Heward-Mills' ministry and the Healing Jesus Campaign) currently depends on churches, bishops, and intermediaries to know who its partners are and who has paid. That makes the office slow, dependent, and often blind: even answering "how many people paid this month?" takes weeks and goes stale immediately.

The goal is direct relationship at scale. Roughly 40,000 partners worldwide should be able to give through a handful of universal, well-known channels, and the BENMP office should be able to see, thank, and stay in touch with every one of them — without routing through any intermediary church or branch. Ministries like Benny Hinn's manage this relationship themselves end-to-end; BENMP wants the same posture.

The client's mental model of the product is an AI: a system that knows every partner, messages them personally, and can answer "who paid, who didn't, per region" at month end. This spec takes that seriously as the product's flagship interface, while being honest about the dependency: the AI is only as good as the data pipeline underneath it. So the product is built as a data spine (intake → matching → acknowledgement → monthly cycle) with an AI assistant on top whose autonomy grows phase by phase.

## 2. Product definition

**BENMP PRM** (UI name: **Global Crusade Partners Platform**) is a staff-only internal system. Partners never log into it; they interact through channels they already use — Mobile Money, WhatsApp, SMS, email, phone calls.

Three-sentence version: Money arrives through a small set of universal giving channels and instantly becomes a partner record, a thank-you, and (if it's a big gift) a priority phone call. Every month the system runs the BENMP cycle — remind, receive, acknowledge, close — and on the 1st the office knows exactly who gave, who lapsed, and what to do next, per region. Staff work through an operations console, and an AI assistant answers questions, drafts personal messages, and eventually runs supervised workflows over all of it.

### Non-goals

- A public app or portal partners must adopt (the existing benmp.com donation pages stay).
- Autonomous unsupervised messaging (AI drafts and proposes; staff approves — the approval gate loosens gradually, never disappears for bulk sends).
- Storing card data or processing payments in-app (providers remain the systems of record for payment execution).
- A social network for partners; a full call center.

## 3. Users

| Role | What they do here |
| --- | --- |
| Super admin | Configuration, roles, thresholds, providers |
| Finance | Intake reconciliation, imports, giving health, month-end close |
| Communications | Segments, templates, batches, sequences, consent |
| Regional coordinator | Partner and follow-up queues scoped to their region block |
| Prayer team | Prayer requests and pastoral follow-up |
| Viewer/auditor | Read-only reporting |

## 4. Core domain concepts

The schema draft in `supabase/migrations/0001_initial_schema.sql` already covers most of this. New concepts from the latest client requirements are marked **(new)**.

- **Partner** — profile (name, mobile, WhatsApp, email, country, city, church, partner-since date, level, giving frequency, preferred channel, birthday, prayer requests, notes, tags, assigned coordinator) plus computed giving status.
- **Region block (new)** — the operational blocks the office manages by, seeded as: **Ghana, Rest of Africa, Europe, UK, America, South America, Australia/Asia** (from board meetings; not publicly documented, pending office confirmation). Implemented as a configurable lookup table, not a hard-coded enum, so the list can change without a migration. Every partner belongs to exactly one block (derived from country, overridable). All headline reporting is per block.
- **Payment event** — immutable raw record from a CSV payment import or manual entry, kept before matching so nothing is ever silently lost.
- **Contribution** — a verified gift matched to a partner: date, amount, currency, method, campaign, provider reference, acknowledgement status, attention tier.
- **Monthly cycle (new, the heartbeat)** — see §5. Each month has a lifecycle: reminders out → gifts in → acknowledgements out → close. A **monthly snapshot** freezes per-block stats at close so history stays queryable.
- **Status rules** — $5/month baseline; **$60/year ⇒ active for the year**; **$100+ or notably above the partner's usual gift ⇒ high-touch flag** (priority call, special acknowledgement, future VIP attention). Everyone gets thanked and is call-eligible; the flag prioritizes limited staff time. Implementation: gifts are stored in their original currency and converted to USD at the gift-date rate; thresholds apply to USD-equivalent totals. Threshold amounts live in admin-editable configuration (not code) — the board may change the numbers or later pin fixed local amounts per block.
- **Campaign/crusade** — first-class records with funding status, supporting partners, reports, testimonies, message history.
- **Segment** — saved partner filters ("Ghana monthly partners who missed June", "new partners this month", "high-touch, America block").
- **Message** — template + merge fields + channel + consent check + delivery status; batches require approval.
- **Follow-up task** — owner, due date, reason, channel, outcome, call notes.
- **Audit log** — every sensitive read/write, every AI suggestion and approval.

## 5. The monthly cycle (core product loop)

This is the loop the client described and the thing the office cannot do today. Everything else supports it.

```
        ┌─ during month ────────────────────────────────────────────┐
Remind ─►  Gift arrives (recorded via CSV import / manual)             │
        │        │                                                  │
        │        ▼                                                  │
        │  payment_event ─► verify ─► match partner ─► contribution │
        │        │ (unmatched ─► reconciliation queue)              │
        │        ▼                                                  │
        │  Personalized thank-you (auto after Phase 3)              │
        │        ▼                                                  │
        │  ≥ high-touch threshold? ─► priority call task            │
        └───────────────────────────────────────────────────────────┘
Month end ─► Close: per-block snapshot (paid / unpaid / % active /
             totals / new / lapsed) ─► follow-up queues populated
```

- **Reminders**: near month-end, partners who haven't given get a personalized nudge on their preferred channel ("Hello Mr. Mensah, thank you for your continued partnership…"). Batch is staff-approved before send.
- **Acknowledgement**: every successful gift produces a personal thank-you from the BENMP office within a minute — the single most important relational moment in the whole system.
- **Close**: on the 1st, the previous month is frozen. The office (and the AI assistant) can answer instantly: how many partners per block, who paid, % active vs inactive, contributions per block, who needs a call. Lapsed partners flow into gentle follow-up, not shame.

## 6. Payment intake — CSV only (Decision 0007)

The system **takes no live payments and integrates no payment provider**. Money lands wherever the partner sends it — Ghana MoMo wallet, bank, or a remittance app worldwide — and the office already exports a **CSV/statement of that money per period**. That CSV is the single intake. Staff upload it on the backend; the system matches each row against the partner database and ticks who has paid.

Why this is the right shape, not a downgrade:

- **Automatic detection was never really available.** A consumer wallet or remittance transfer is a P2P push — *nothing notifies software when money lands*. The only "instant" alternative is a registered merchant rail, which means merchant-tier onboarding, KYC, business documents, per-provider webhook security, and provider outages — real calendar-time and risk for a signal the office can already reconstruct from its statement. SMS parsing (the office prototype's path) is rejected forever: per-network fragile, hardware-dependent, unverifiable.
- **The CSV is the trustworthy ledger.** The office is never more than one export behind, and reconciliation — matching truncated statement names to real partners — is exactly the workflow the app makes fast.

Design of the intake:

```
CSV upload → payment_import_rows → validate → match (normalized phone → email → reference)
   → matched?  yes → payment_events (source csv_import) → contribution → tick paid → thank-you
              no  → reconciliation queue → staff match / create-partner / dismiss
```

- **One intake door.** Every row lands in `payment_events` (source `csv_import`) and flows through the same `match → contribution → acknowledgement` pipeline as manual finance entry. There is no `receivePaymentWebhook`, no signature verification, no provider re-query.
- **Reconciliation is first-class, not an exception.** Because there is no provider identity to lean on, the reconciliation queue absorbs every ambiguous row; staff match to an existing partner, create a partner, or dismiss with a reason. This was already built for the old remittance channel — it is now the primary path.
- **Matching keys**: canonicalized phone (E.164) first, then email, then a published reference-word convention (e.g. the partner's phone or "BENMP" on bank transfers), then manual reconciliation. Phone normalization is foundational — it is also the WhatsApp key.
- **Idempotency by row.** Re-importing the same CSV row is inert (per-row dedupe key on `payment_events`, row-hash on `payment_import_rows`). Imports are a preview → commit ritual, not a fire-and-forget.
- **Recurring giving is prompt-driven, never charged.** `recurring_commitments` are **pledge records** (expected monthly amount) used to flag who has not yet appeared in a period's CSV and to drive the reminder loop. Nothing auto-debits anyone; the reminder loop *is* the recurring mechanism, and the CSV match closes it.
- Never store card data or account numbers beyond what a matched contribution needs.

> **Removed with Decision 0007** (was §6/Decision 0005): the three merchant-first published channels, all provider webhooks (Paystack/Hubtel/Stripe/pawaPay/Flutterwave), the WhatsApp claim loop as a giving channel, and the prefilled-invoice recurring-charge cron. The reasoning above (why detection is impossible without a merchant rail, why SMS parsing is rejected) is retained because it still justifies the CSV-only shape. If the office later wants money to land in-app with instant confirmation, a payment adapter can be reintroduced behind the retained `payment_events` pipeline.

## 7. Messaging

- **Channels**: WhatsApp (primary — it's where the partners are), SMS (fallback/preference), email (newsletters, receipts). Phone calls are a staff workflow (call queue + scripts + outcome logging), not telephony integration, until Phase 6+.
- **Provider strategy**: start with Twilio for pilot speed; move or dual-run to direct Meta Cloud API for long-term ownership (tradeoffs documented in `docs/board-meeting-brief.md`). The messaging adapter boundary already exists.
- **Personalization, not generic blasts**: every template merges name, amount, giving history, campaign context, and tone. AI drafting (Phase 5) makes this scale to 40k without feeling mass-produced.
- **Message types**: instant thank-yous, monthly reminders, welcome series, crusade updates and reports, testimonies, birthday greetings, prayer messages "from the Prophet" (these get an extra approval step — anything in Bishop Dag's name is sensitive), lapsed-partner gentle follow-up.
- **Governance**: per-channel consent and opt-out, WhatsApp template categories and approval status, delivery tracking, all sends logged. Bulk sends always require staff approval.
- **How approval scales to 40k** (it must never mean 40k clicks): approval attaches to *levels*, not messages. Level 1 — one named approval covers one batch, any size (this alone handles the monthly reminder run). Level 2, trigger-gated — an **approved policy** (template + segment + cadence, e.g. "monthly reminder to lapsed partners") lets recurring runs proceed automatically, with automatic re-approval demanded when the template or category changes, the segment size deviates sharply from approved runs, or a kill switch pauses sends. The human gate never disappears; it moves up an altitude as trust accumulates. Prophet-category content never gets policy-level automation — always two named approvers per batch.

## 8. The AI assistant — an agentic system, staged

Positioning: **the assistant is the product's face; the pipeline is its brain-food.** The client wants it agentic — a system that "handles and communicates with all partners worldwide" — and the design says yes to that ambition while staging the autonomy (Decision 0001). Four agentic behaviors, shipped in ladder order:

1. **Answering (analyst, Phase 4)** — operational Q&A over live data with cited numbers: partners per block, paid/unpaid, % active, contributions per block, trends; partner briefs before calls; segment previews.
2. **Acting on request (operator, Phase 5)** — multi-step execution of staff intents: "message all lapsed UK partners gently" → build segment → check consent → draft personalized variants → present batch for approval → dispatch → report outcomes. Every chain pauses at a human gate before anything sends or mutates.
3. **Working on schedule (workflow agent, Phase 5–6)** — the monthly cycle run as durable, resumable, pausable agent workflows: reminders out, month closed, close-report drafted, follow-ups queued.
4. **Noticing (watchdog, Phase 6)** — unprompted surfacing into a suggestion inbox: above-usual gifts, block-level trend drops, payment-failure spikes, duplicate suspects. Suggestions are reviewed, never auto-acted.

Architecture principles:

- **One agent core, many surfaces.** The same tool registry + policy layer serves the chat UI, scheduled runs, and event triggers (e.g. a high-touch gift spawns a caller-brief task). No parallel bots.
- **Capability tiers enforced structurally.** Tools are classed read / draft / mutate / send. Mutate/send tools require an **approval envelope**: the agent prepares the action; only a human-created approval token lets the executor complete it. Safety does not depend on prompt obedience.
- **The database is the memory.** Partner knowledge = the PRM record via `PrmRepository` queries. No vector store in v1; add retrieval infrastructure only when a concrete need appears.
- **Partner-supplied text is untrusted input.** Prayer requests, claim messages, and notes enter agent context as quoted data, never as instructions — prompt injection through a prayer request must be assumed and neutralized by the envelope model regardless.
- **Cost realism at 40k partners.** Bulk personalization is template+merge (deterministic, auditable, free); LLM generation is spent where it pays — high-touch partners, briefs, reports — under per-run budgets, with model tiers (cheap drafting / strong analysis) behind the AI SDK 7 registry.
- **Evals from day one.** The five headline questions run as a golden set against seed data in CI; drafting obeys tone rules (ministry voice, no promises, no doctrinal improvisation); inbox accept/reject decisions are logged as future training/eval data.

Standing technical rules: AI SDK 7 behind the local model registry (provider-agnostic by project policy); tools defined in application language over `PrmRepository`; the agent inherits the invoking staff user's role and RLS scope (scheduled runs use a dedicated service identity with an explicit, minimal toolset); every run logged to `ai_runs` with tools, tokens, and cost; prompts containing partner data are sensitive operational data; "from the Prophet" content always carries the two-approver rule.

Per-capability requirements (each gate must hold before that capability ships):

| Capability | Ships with | Hard requirements |
| --- | --- | --- |
| Analyst (read-only) | Phase 4 | Staff auth; RLS-scoped reads; **no write tools registered at all**; every run logged; answers cite their counts |
| Drafter | Phase 5 | Staff review before any send; WhatsApp template category/approval metadata; consent checks inside the pipeline; message versions saved before dispatch |
| Operator | Phase 5–6 | Approval envelope + human-readable diff for every mutation; every suggestion and acceptance audited |
| Workflow agent | Phase 6+ | Durable runs, retries + idempotency, pause/cancel controls, cost tracking |

Kill-switches: `app_settings` flags gate auto-send, scheduled agent runs, and the watchdog independently. Candidate tool names (build only when their phase needs them): `searchPartners`, `getPartnerBrief`, `getRegionStats`, `getMonthlyCycleStatus`, `previewSegment`, `summarizeCampaign`, `draftPartnerMessage`, `suggestFollowUps`, `reconcilePaymentImport`, `findDuplicatePartners`, `createApprovedTasks`, `queueApprovedMessages`.

## 9. Architecture

Unchanged from `docs/architecture.md`, summarized:

- **Frontend**: Next.js 16 App Router, React 19, Tailwind 4. Staff console with Today (operations queue), Partners, Giving, Communication, Follow-up, Campaigns, Prayer, Reports, AI, Admin.
- **Data**: adapter-first `PrmRepository`. Mock today; **Supabase Postgres is the confirmed recommendation** (Decision 0004). The team weighed MySQL vs Supabase vs GCP Postgres: MySQL offers no advantage for this relational, RLS-heavy domain; "Supabase vs Postgres" is a false choice — Supabase *is* managed Postgres, plus auth, RLS, storage, and realtime that we'd otherwise assemble by hand on GCP. The schema stays ordinary Postgres and business logic stays behind the repository, so Neon/Aurora/Cloud SQL remain open exits. Supabase Auth + RLS for staff roles.
- **Data access**: all staff see all partners initially; roles govern *actions* (finance vs comms vs viewer). Region-scoped visibility for coordinators is designed into the schema (assignments table + RLS-ready policies) but not enforced until coordinators onboard.
- **Integrations**: data and messaging provider adapters behind env-switched factories (`BENMP_DATA_PROVIDER`, `BENMP_MESSAGING_PROVIDER`). No payment provider — intake is CSV (Decision 0007).
- **Deployment**: Vercel + Supabase.
- **Security**: no secrets/partner data in git; RLS everywhere; audit log on sensitive actions; service-role keys server-only; CSV import validated and finance/admin-gated; messaging webhook signature verification.

## 10. Third-party packages assessed

Two `@firstlovecenter` packages were suggested by engineers (First Love Center is within the same ministry family — org alignment is real, and their `configure*()` port-injection architecture is genuinely well designed). Assessed 2026-07-08 from the published tarballs and registry metadata:

**`@firstlovecenter/ai-chat` (v0.31.0) — crib the architecture; adopt only after a spike.** A drop-in Next.js AI chat module: agent tool-loop, SSE routes, session persistence, full chat UI including an Intercom-style floating bubble, and an excellent 18-code error taxonomy. Host injects auth, scope, and tools via `configureAiChat()` — exactly the right shape for our Phase 4 assistant. Caveats that block naive adoption: it is **locked to Google Vertex AI** (Claude/Gemini/Grok via GCP), conflicting with our provider-agnostic AI SDK 7 rule; its persistence layer documents **MySQL-only assumptions** (we are Postgres/Supabase); it is 0.x with heavy API churn (52 releases in ~8 weeks), single-maintainer, private source. Plan: build our chat surface on AI SDK 7 per §8, deliberately borrowing its patterns (port injection, session model, error taxonomy, bubble UX); revisit adoption if the package gains a provider-agnostic model port and Postgres support. A one-day Phase 4 spike may revise this.

**`@firstlovecenter/flc-profile` (v0.5.1) — do not adopt.** A Google-Forms-style dynamic custom-fields/profile engine. Our partners, contributions, and statuses are first-class typed entities with computed rules ($60/$100 thresholds, region blocks) — outsourcing them to a dynamic-fields engine would fight the schema, and it is Prisma-coupled (we have no Prisma). Only relevant if we later want staff-configurable custom partner attributes.

Also noted in the same org: `flc-notify-service` (SMS/email microservices — worth a look when Workstream C picks providers) and `@firstlovecenter/milestone-grid` (completion-gate grids — possible fit for onboarding checklists, not a current need).

## 11. Reference systems

- **benmp.com** — existing public donation/registration flow (Paystack links, PayPal). Stays; this system is the internal console behind it. Open question: sync with its database or start clean with imports (recommendation: start clean, import, and treat this system as the new source of truth going forward).
- **benmp-app.vercel.app** (source: `iCanTutoring/benmp-app`, private) — office prototype ("BENMP Live"), Next.js 14 + Supabase, reviewed 2026-07-08. Three intake paths: (a) Flutterwave MoMo charge API with signed webhook + poll fallback — **proven working in test mode**; (b) SMS-forwarder parsing of MoMo received-payment texts — built but hardware-blocked (needs an Android phone holding the MoMo SIM) and the path we explicitly reject; (c) manual entry API. Worth reusing: its webhook idempotency pattern (reference key + tolerate duplicate-insert), phone-normalization matching with name fallback, MTN SMS parser's real-world message-variant handling (as reference for reconciliation, not intake), and thank-you/VIP/reminder message templating with title-stripping. Missing: auth, audit log, webhook retry; its public read policy exposes donor data. ⚠️ As of 2026-07-08 its public `/partners` page exposes partner names, phone numbers, and bank account identifiers with no login — the office should be told to take it down or gate it.
- **HJC-Portal** — visual/operational patterns reference (dark sidebar, stat cards, tables, CSV, roles, audit) — schema not reusable.
- **FLOW** (First Love Church's giving system) — the client's reference model, per the "Ways to Give" poster: a per-region channel menu anchored on one memorable MoMo number (reachable locally and via worldwide remittance apps), regional bank accounts with reference words, US text-to-give, PayPal, and web/card. Lessons folded into §6.

## 12. Success criteria

The system succeeds when the BENMP office can, without asking any church or intermediary:

1. Know within a minute of any gift: who gave, how much, from where — and the partner gets a personal thank-you.
2. Answer at month close, per region block: how many partners, who paid, who didn't, % active, totals — instantly, including by asking the AI in plain language.
3. Reach any partner or segment personally on their preferred channel, with approval-gated automation doing the heavy lifting.
4. Give high-touch partners visibly faster, warmer attention.
5. Operate at 40,000 partners with a small staff.

## 13. Decisions resolved and still open

Resolved 2026-07-08 with David (recorded in Decision 0004):

1. ~~Payment rails: Paystack / Hubtel / pawaPay / Stripe.~~ **Superseded by Decision 0007** — no payment provider; intake is a CSV import. No SMS parsing.
2. ✅ WhatsApp: Twilio pilot first; Meta Business verification started in parallel.
3. ✅ Partner data: clean CSV import (office Excel sheets + benmp.com export); this system becomes the source of truth.
4. ✅ Backend: Supabase (managed Postgres + auth + RLS), behind the existing repository adapter.
5. ✅ Thresholds: USD baseline with FX conversion at gift date; amounts admin-configurable.
6. ✅ Data access: all staff see all initially; region scoping schema-ready but deferred.
7. ✅ Region blocks: configurable lookup, seeded Ghana / Rest of Africa / Europe / UK / America / South America / Australia/Asia.

Still open (mostly client-side):

1. Office confirmation of the exact region-block list.
2. A representative payment CSV export per period — the real column layout the office produces — so the importer and matching rules can be built against it (no synthetic guess).
3. The official published giving channels (exact USSD code, pay-link URLs, bank details) and who owns each provider account.
4. Staff list and initial role assignments.
5. Whether the benmp.com website's registration/donation forms should later push new records into this system (one-way feed) once it is the source of truth.
6. ~~Does the board want a US text-to-give channel?~~ Moot under Decision 0007 — no live payment channels; money is reconciled from the periodic CSV.
7. Which BENMP MoMo number/bank accounts become the published channels, and can we get regular statements (CSV or API) from each for import?

## Appendix A — UI redesign proposal (temporary — delete after team review)

Audit of the mock MVP frontend, 2026-07-08 (full code read + rendered app). **Proposal, not decision.** The mock MVP is not the law.

**Keep**: the shell (dark sidebar, topbar search, mobile nav), the primitives (`MetricCard`/`Panel`/`RecordList`/`StatusBadge`), URL-backed state (built to become backend queries), the status vocabulary, and the Today "work the queues" mental model.

**Change (proposed)**:

1. **Cut the meta-panels** — ~6 panels explain architecture to the board, not tools to staff: "Backend Readiness" (on Reports *and* Admin), "Adapter Status"/"Provider Adapters", "Data Readiness", "Approval Controls", "Care Routing", the current `/ai` page, the sidebar footer note. Docs carry that story now; at most one "System" panel survives on Admin.
2. **One home per object type** — acknowledgements, message batches, tasks, and segments each render on 2–3 pages today. Giving owns gifts/acks, Communication owns batches/segments, Follow-up owns tasks; Today shows only "needs action now" slices that deep-link there.
3. **Queue-first Today** — the 4-mode form console duplicates the pages' forms with divergent localStorage state; proposal: Today = metrics + action queues + quick actions opening the one canonical form.
4. **Leaner nav** — 10 items for ~6 jobs. Proposed: Today · Partners · Giving · Messages · Campaigns · Prayer · Reports · Admin; Follow-up folds into Today; **AI leaves the nav** and becomes an ambient docked assistant on every page + "Brief me" buttons on records.
5. **End demo-data theater at Phase 1B** — real numbers or visibly-labeled demo; replace the double-rendered partner directory (cards + table both in DOM) before the 40k dataset; hide the dead notifications bell.

**Sprint tie-in**: the week only wires Today, Partners, Giving, Reports, AI — proposal: trim the nav to those + Admin during the sprint; parked pages return as Phases 3/5 land.

**Team questions**: ① queue-first Today vs form-console? ② leaner 8-item nav, Follow-up into Today? ③ AI as ambient assistant, no nav item? ④ trim nav during sprint week? ⑤ visual redesign now or keep the shell and spend the week on function? (Audit recommends: keep the shell — working over looking nice.)
