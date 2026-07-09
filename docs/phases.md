# BENMP PRM — Phased Implementation Plan

> The build playbook and keystone of the docs set. Each phase is self-contained and deliverable by an AI agent in 1–3 days, in strict dependency order (parallel only where noted). Hand the **Prompt** block at the bottom of each phase to the agent verbatim — it references the rest of `docs/`. The agent should always read [README.md](./README.md), [srs.md](./srs.md), [tech-stack.md](./tech-stack.md), [db-schema.md](./db-schema.md), and [decisions.md](./decisions.md) before coding. This build is **test-driven**: each phase's `VERIFY` block lists the executable tests that must be green before the next phase starts. Record deviations as **"As-built notes (Phase N, date)"**; the schema is authoritative.

## Definition of done

Completion is proven by tests, never asserted. No task or phase is "done" on inspection, a screenshot, or a say-so.

- **A task is done when its named test is green.** Work test-first: write the task's test from its `VERIFY` line, watch it **fail** (red — the code doesn't exist yet), then implement until it **passes** (green). Green test = task complete.
- **A phase is done when the full gate is green**: `npm run typecheck && npm run lint && npm test && npm run build`, plus `npm run test:e2e` for the flows that phase delivers. A later task cannot be called done if it turned an earlier task's test red — the whole suite must stay green at the phase boundary.
- **Tests must exercise real behaviour, including the negative cases.** A test that always passes proves nothing. Assert the actual outcome and its failure modes (e.g. "bad signature → 4xx + audit row, *no writes*"; "re-import → *no* duplicate"; "1234 minor units round-trips exactly").
- **Green ≠ shipped for human-in-the-loop rails.** Live sends and real-money charges are tested against **sandbox/test credentials**; the green test proves the code path and reconciliation are correct. A final real-money/real-delivery smoke check belongs in the demo/hardening step (Phase 13), not in place of the gate.

> **Status of this doc**: all phases **0–13 drafted**. This file supersedes the coarse phase list in `docs/delivery-plan.md`; that doc's Workstreams, one-week sprint, and Cross-phase rules remain a useful companion until folded in. The schema every phase relies on is `docs/db-schema.md` (incl. the `invoices` + `recurring_commitments` model behind the recurring-giving loop).

## Phase summary

| # | Phase | Depends on | Parallel |
|---|---|---|---|
| 0 | Foundation & test harness | — | — |
| 1 | Database (Supabase schema, migrations, core tables) | 0 | — |
| 2 | Authentication (Supabase Auth, invite → verify) | 1 | — |
| 3 | Roles & audit log | 2 | — |
| 4 | Importer pipeline (CSV, phone E.164, dedup) | 3 | — |
| 5 | Partner profile (create/view, native profile) | 4 | — |
| 6 | Payments intake (Paystack + Stripe webhooks) | 5 | — |
| 7 | Statement imports & reconciliation | 6 | — |
| 8 | Messaging (Twilio + Resend, consent, ack) | 6 | with 7,9 |
| 9 | New-partner signup & payment setup | 6 | with 7,8 |
| 10 | Recurring giving (Stripe subs + MoMo cron) | 6,8 | — |
| 11 | AI assistant (Claude on Vertex, read-only) | 6 | from 6 |
| 12 | Monthly cycle & reports (snapshots, close) | 8,11 | — |
| 13 | Scale & hardening (regional RLS, 40k, call queue) | 12 | — |

---

## Phase 0 — Foundation & test harness

**Prereq**: the mock MVP (Next.js app, `PrmRepository` mock, all core pages).

**Deliverable**: the executable TDD gate — Vitest + Playwright installed and green, CI wired, and the existing adapter seams covered by contract tests so later phases can swap providers safely.

**Prompt**:

```
Stand up the test harness for BENMP PRM (the TDD gate all later phases depend on).
Read docs/tech-stack.md §Testing and AGENTS.md first.

1. Vitest: vitest.config.ts (node env, @/* alias, collects src/**/*.test.ts), npm
   scripts test + test:watch, and one real test (src/lib/utils.test.ts). [done]
2. Playwright: playwright.config.ts (auto-starts npm run dev), npm script test:e2e,
   and e2e/smoke.spec.ts asserting the home page boots. [done]
3. src/lib/data/prm-repository.contract.test.ts — a describe() suite parameterized by a
   repository instance, asserting each PrmRepository method returns its typed shape. Run
   it against the mock repo; export it so Phase 1 reruns it against the Supabase repository.
4. Assert the provider factory (src/lib/data/index.ts) returns the mock when
   BENMP_DATA_PROVIDER is unset.
5. src/lib/data/testdb.ts — integration-DB helper gated on DATABASE_URL_TEST: migrate a
   scratch Postgres, expose a client, teardown. Tests using it skip when the var is absent.
6. .github/workflows/ci.yml — node 22, npm ci, typecheck → lint → test → build, with a
   postgres:16 service exposing DATABASE_URL_TEST for integration tests.

VERIFY:
- Unit (Vitest): npm test green — utils formatting + PrmRepository contract (mock) +
  factory-default.
- E2E (Playwright): npm run test:e2e green — home page boots (e2e/smoke.spec.ts).
- Gate: npm run typecheck && npm run lint && npm test && npm run build all green; CI
  passes on the PR that adds it.
```

---

## Phase 1 — Database (Supabase schema, migrations, core tables)

**Prereq**: Phase 0.

**Deliverable**: the real data layer — Supabase Postgres with every core table migrated (RLS + policies per table), generated types, and `SupabasePrmRepository` passing the same contract suite the mock passes. No ORM (Decision 0006).

**Prompt**:

```
Implement the BENMP PRM database on Supabase Postgres (no ORM — Decision 0006).
Read docs/db-schema.md (the authoritative contract), docs/decisions.md 0006 (just-Supabase,
RLS is the gate), docs/tech-stack.md §Data layer, and src/lib/data/types.ts (PrmRepository).

1. Extend supabase/migrations/ (SQL). Build on 0001_initial_schema.sql; add migrations for
   anything missing. Enable RLS + per-role policies in the SAME migration that creates a table.
2. Model EVERY table in db-schema.md (authoritative). The full core set:
   - Staff/authz: profiles (+ staff_role enum, id → auth.users), staff_country_assignments
   - Partner care: partners (all §6 fields incl. region_block_id FK, normalized_phone,
     per-channel consent), partner_notes, prayer_requests, follow_up_tasks
   - Giving: payment_events (raw jsonb, UNIQUE (provider, provider_event_id)),
     contributions, recurring_commitments (the pledge — channel-aware per §7),
     invoices (per-cycle bill — §7), payment_imports, payment_import_rows, fx_rates
   - Campaigns: campaigns
   - Communication: communication_segments, segment_members, message_templates,
     communication_batches, communication_messages
   - AI/audit: ai_runs, audit_log
   - Config: region_blocks, country_region_defaults, app_settings
   MONEY: original amounts are integer minor units (amount_minor) + currency; usd_equivalent
   is numeric (client returns it as a string — no JS float). All enums per db-schema.md §4.
3. Generate types: supabase gen types typescript → src/lib/data/database.types.ts.
4. Seed (SQL seed or npm run db:seed): 7 region blocks (Ghana, Rest of Africa, Europe, UK,
   America, South America, Australia/Asia), country_region_defaults, app_settings
   thresholds, minimal ack + reminder
   templates (not auto-send), one super_admin + one viewer profile.
5. src/lib/data/supabase-prm-repository.ts implementing every PrmRepository method via
   @supabase/supabase-js server clients; wire the factory to BENMP_DATA_PROVIDER
   (mock default, supabase → this impl). Keep Supabase specifics inside src/lib/data/ + src/lib/supabase/.

CONSTRAINTS: money never touches JS float. RLS is the authorization gate (viewer writes must
fail at the DB). Service-role key server-only, used only where RLS must be bypassed (seeds).

VERIFY:
- Integration (Vitest, test Supabase project / DATABASE_URL_TEST): migrations + seed
  succeed; 7 region blocks + country→block lookup; contribution stores 1234 minor units and
  reads back exactly; usd_equivalent numeric preserved; duplicate payment_events reference →
  unique violation; invoices unique (recurring_commitment_id, period_month) blocks a
  double-bill; app_settings seeded with the three keys.
- Contract: the Phase 0 PrmRepository contract suite passes against the Supabase repository.
- RLS: a viewer-role client cannot insert/update a partner (fails at the DB).
- Unit: factory returns the Supabase impl when BENMP_DATA_PROVIDER=supabase, mock otherwise.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 2 — Authentication (Supabase Auth, invite → verify)

**Prereq**: Phase 1.

**Deliverable**: staff log in against real Supabase Auth; all app routes protected; a super-admin invites a new staff member by name/email/role, who verifies via an email link and sets a password.

**Prompt**:

```
Add Supabase Auth + staff invite/verify on top of Phase 1.
Read docs/tech-stack.md §Auth, node_modules/next/dist/docs (proxy.ts, not middleware.ts),
src/proxy.ts, docs/decisions.md 0004.

1. src/lib/supabase/{server,browser}.ts via @supabase/ssr — all Supabase specifics here.
2. /login (email/password) + sign-out server action; on success route into the app.
3. src/proxy.ts: protect every app route; allow-list /login and /api/webhooks/*.
4. Invite flow: an admin-only action taking { name, email, staff_role } → Supabase admin
   invite; create/link a profiles row (status invited). The verify link opens a
   set-password page that activates the profile.

CONSTRAINTS: service-role key server-only. No role ENFORCEMENT yet beyond authenticated
vs not — RBAC is Phase 3.

VERIFY:
- E2E (Playwright): valid creds → into app; invalid → error, stays on /login;
  unauthenticated GET /partners → redirect to login; /api/webhooks/paystack reachable
  without a session; invite token → set password → login succeeds.
- Integration (Vitest): invite creates a profiles row with the chosen role + pending
  status and records a (mocked) email send.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 3 — Roles & audit log

**Prereq**: Phase 2.

**Deliverable**: role-based authorization enforced by RLS per role (Decision 0006, just-Supabase), with matching server-action checks, plus an audit trail on every sensitive mutation, viewable by admins.

**Prompt**:

```
Add RBAC + audit logging on top of Phase 2.
Read docs/security.md (RLS is the gate), docs/decisions.md 0006, docs/db-schema.md (audit_log).

1. Author RLS policies per role for every operational table (staff_role ∈ {super_admin,
   finance, comms, coordinator, prayer, viewer}); viewer is read-only at the DB. A
   src/lib/auth/policy.ts can(role, action) helper mirrors the policies for UI gating +
   server-action validation, but RLS is the enforcement.
2. Server actions validate role + input; RLS enforces writes (a viewer insert/update fails
   at the database, not just in app code).
3. src/lib/audit.ts writeAudit({ actor, action, entity, before, after }) called from all
   sensitive mutations (creates, updates, deletes, imports, reconciliation dismissals).
4. /admin/audit list (admin+). Keep Supabase RLS enabled as a backstop but do not rely
   on it as the primary gate.

VERIFY:
- Unit (Vitest): the full can(role, action) matrix — viewer write → false, finance
  record-gift → true, etc.
- Integration (Vitest): a mutating action writes exactly one audit_log row with actor +
  before/after.
- E2E (Playwright): viewer record-gift → rejected; finance → allowed; a viewer cannot
  open /admin/audit; an admin sees the new entry.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 4 — Importer pipeline (CSV, phone E.164, dedup)

**Prereq**: Phase 3.

**Deliverable**: the office's real partner list loads via a CSV importer — upload → map columns → normalize phones → dedup review → commit — with import batches, audit rows, and a rejects list. "If you build and can't import, it's useless" (transcript).

**Prompt**:

```
Build the partner CSV importer on top of Phase 3.
Read docs/design-spec.md §4 (partner concept, matching keys), src/lib/data/types.ts
(extend with import methods if needed), docs/db-schema.md (import_batch, partners).

1. src/lib/phone.ts toE164(raw, defaultCountry='GH') — 0-prefixed Ghana, +233, bare
   9-digit forms. THE ONLY place phones are normalized/compared.
2. /partners/import: upload (papaparse) → header-mapping UI → preview with per-row
   validation → dedup review (existing partner by E.164 or email → flag with merge/skip)
   → commit writing partners + an import_batch + audit_log rows. Region block assigned
   via country_region_defaults, overridable on the partner.
3. Rejects list (with reasons) shown after commit — nothing dropped silently.
4. Empty states for Partners/Giving/Communication when tables are empty.
5. Create fixtures/partners-sample.csv.

CONSTRAINTS: phone comparison ONLY via src/lib/phone.ts. Imports idempotent-safe via the
batch id.

VERIFY:
- Unit (Vitest): a table of phone variants → expected E.164; junk → null.
- Integration (Vitest): fixture import → partners with normalized phones + region blocks,
  batch id tying the rows; re-import same file → duplicates flagged, no double insert;
  malformed row → reject with a reason.
- E2E (Playwright): upload → map → preview → commit; rejects list renders; empty DB shows
  empty state, not an error.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 5 — Partner profile (create/view, native profile)

**Prereq**: Phase 4.

**Deliverable**: staff create and edit a partner and open a full profile (identity, giving status, recent gifts, open tasks, prayer flags); Today-console actions persist to the DB instead of `localStorage`. Built natively on the existing `partners` tables (the transcript's "profile" NPM package is not a hard dependency — Decision 0006).

**Prompt**:

```
Build partner profile + persistent Today console on top of Phase 4.
Read src/components/workspace/today-workspace.tsx (the localStorage behavior you replace),
src/lib/data/types.ts, docs/design-spec.md §4.

1. Build the partner profile natively on the existing partners tables (identity + related
   giving/tasks/prayer). No external "profile" package (Decision 0006). Add a
   partner_profiles table only if a real need appears; record it in decisions.md.
2. Create/edit partner server actions + forms (name/email/phone/country/region); region
   block overridable.
3. Partner profile page: identity, giving status, recent gifts, open follow-up tasks,
   prayer flags — degrade gracefully where Phase 6 gift data isn't present yet.
4. Replace ALL localStorage persistence in the Today workspace with server actions
   calling the repository; keep a mock-only demo reset.

CONSTRAINTS: phones via src/lib/phone.ts only; viewer role still fenced (Phase 3).

VERIFY:
- E2E (Playwright): create partner → appears in list with normalized phone; edit region
  block → persists across reload; a seeded partner's profile renders identity + giving
  status; a Today action (record gift / capture partner / assign follow-up) survives
  logout AND a different browser.
- Integration (Vitest): a profile round-trips through the repository.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 6 — Payments intake (Paystack + Stripe webhooks)

**Prereq**: Phase 5. Paystack + Stripe test credentials.

**Deliverable**: a gift through a webhook rail becomes a verified, matched `contribution` with an acknowledgement draft — and, when it answers an open `invoice`, marks that invoice paid. The §5 pipeline live for the two instant channels.

**Prompt**:

```
Implement webhook intake on top of Phase 5.
Read docs/design-spec.md §5 (the gift pipeline — implement exactly this) + §6 (channel
model), docs/decisions.md 0004/0005, db-schema.md (payment_events, contributions, invoices).

1. src/lib/payments/types.ts: PaymentAdapter { verifyAndParseWebhook(request) ->
   RawPaymentEvent, verifyTransaction(ref) }, provider registry on BENMP_PAYMENT_PROVIDER
   (mock default preserved). Provider SDKs confined to src/lib/payments/<provider>/.
2. Paystack: /api/webhooks/paystack verifies x-paystack-signature (HMAC-SHA512 of raw
   body), inserts payment_events (dedupe on (provider, provider_event_id) — tolerate
   23505), re-queries the verify endpoint before promotion. Handle charge.success and
   paymentrequest.success (Invoices).
3. Stripe: /api/webhooks/stripe verifies the Stripe signature; handle
   checkout.session.completed, invoice.paid (subscriptions).
4. Matching (src/lib/payments/match.ts): E.164 phone (via src/lib/phone.ts) → provider
   customer → email → status 'unmatched'. Matched events promote to contributions with
   currency + usd_equivalent (fx_rates gift-date lookup, fallback flag when missing).
5. Invoice reconciliation: if a verified event carries an invoice/payment-request/
   subscription-invoice reference, find the open invoices row and mark it paid, linking
   payment_event_id + contribution_id (unpaid→paid transition audited).
6. Status rules (src/lib/giving/status.ts, pure + unit-tested): active-year, high-touch
   (single gift ≥ setting OR ≥3× trailing median), missed-month; thresholds from app_settings.
7. Acknowledgement queue: every matched contribution creates a personalized draft; high-
   touch also creates a priority follow_up_task.

CONSTRAINTS: contributions created ONLY from verified payment_events. Webhook routes skip
auth but MUST verify signatures. At-least-once mindset — every step idempotent.

VERIFY:
- Integration/E2E: signed Paystack charge.success → payment_event + matched contribution
  + ack draft; replay → no dup; bad signature → 4xx + audit row, no writes.
- Integration: a paymentrequest.success referencing an open invoice flips it to paid and
  writes the contribution; Stripe one-time + subscription invoice.paid both land.
- Unit: match.ts + status.ts; threshold-crossing gift creates the priority task.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 7 — Statement imports & reconciliation

**Prereq**: Phase 6.

**Deliverable**: webhook-less money (remittance-to-wallet, bank transfer, manual/cash) enters the same pipeline via imports, and finance has one queue to resolve everything ambiguous.

**Prompt**:

```
Implement statement imports + reconciliation on top of Phase 6.
Read docs/design-spec.md §6 channel 3, docs/decisions.md 0005, and Phase 6 match.ts (reuse,
do not fork). db-schema.md: payment_imports, payment_import_rows (row_hash), payment_events.

1. Parsers in src/lib/payments/statements/: momo-wallet CSV + bank CSV, config-driven
   column mappings. Each row → payment_events source='statement_import', dedup key =
   sha256(account, date, amount, reference/narration) stored on payment_import_rows.row_hash.
2. /giving/imports: upload (papaparse) → mapping preview → commit; payment_imports batch +
   per-row outcomes (matched / queued / duplicate / rejected).
3. Bank narration parsing: extract published reference word / phone, feed match.ts.
4. /giving/reconciliation: unmatched payment_events with raw detail; actions —
   search-and-match partner (promote to contribution + ack draft), create-partner-and-match,
   dismiss (mandatory reason). Everything writes audit_log.
5. Manual gift entry (source='manual') routes through the SAME promotion path.

CONSTRAINTS: one pipeline — statements + manual promote through match.ts/status.ts/ack like
webhooks. Never mutate/delete a payment_event; corrections happen at contribution level.

VERIFY:
- Integration: fixture statement → matched rows become contributions, unknowns queue,
  re-import inert (row_hash).
- E2E: queue match/create/dismiss function + audit; dismissal without reason blocked;
  manual gift for a nonexistent partner cannot bypass the queue.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 8 — Messaging (Twilio + Resend, consent, ack)

**Prereq**: Phase 6. **Parallel with 7, 9.** Twilio sandbox + Resend creds.

**Deliverable**: the system sends — thank-yous automatically (kill-switch governed) and reminder batches with approval — over WhatsApp/SMS/email, with per-channel consent honored.

**Prompt**:

```
Implement live messaging on top of Phase 6.
Read docs/design-spec.md §7, src/lib/messaging/types.ts + mock-adapter.ts, db-schema.md
(communication_* , message_templates, per-channel consent columns).

1. TwilioMessagingAdapter (WhatsApp + SMS) + ResendEmailAdapter behind
   BENMP_MESSAGING_PROVIDER; delivery-status callback route updates communication_messages.
2. Consent: per-channel boolean + timestamp + source on partners; every send path checks
   it; inbound STOP/UNSUBSCRIBE flips consent and confirms.
3. Acknowledgement auto-send: on contribution promotion, if app_settings
   .auto_send_acknowledgements and consent allow, send via preferred channel (WhatsApp→SMS
   fallback). Ack queue remains for review/manual.
4. Reminder batches: build from a saved segment, merge templates, approval screen
   (communication_batches.approved_by/_at), staggered dispatch, per-message status.

CONSTRAINTS: no send without a consent check; no bulk send without a recorded approver.
Provider specifics in src/lib/messaging/<provider>/. Bishop-Dag'-name templates out of scope
until Phase 12.

VERIFY:
- E2E: sandbox thank-you delivered + status tracked; kill-switch off stops auto-send;
  reminder batch requires approval, sends staggered, excludes an opted-out partner; STOP honored.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 9 — New-partner signup & payment setup

**Prereq**: Phase 6. **Parallel with 7, 8.**

**Deliverable**: the "how do new people sign up" flow — a basic public page where a new giver creates a partner profile and sets up their giving (one-time or a recurring commitment), feeding the same partner + payments tables. (Transcript: "make our own website, very basic UI, basic front end.")

**Prompt**:

```
Build the public new-partner signup + giving-setup on top of Phase 6.
Read docs/design-spec.md (public vs staff separation), db-schema.md (partners,
recurring_commitments, invoices, contributions). Keep this public surface isolated from the
internal staff workspace.

1. A minimal public route (separate layout) — no staff auth: capture name, email, phone
   (E.164 via src/lib/phone.ts), country → region block default.
2. Giving setup: one-time gift (Paystack MoMo/card or Stripe) OR a recurring commitment
   (writes recurring_commitments; Stripe card → subscription; MoMo → reminder-driven, no
   mandate). First payment runs through the Phase 6 webhook pipeline.
3. Dedup against existing partners on E.164/email (flag, don't silently merge).
4. Basic UI only — this is a proof-of-concept giver front end, not the staff app.

CONSTRAINTS: public data never bypasses the payment_events pipeline; no card/PIN stored;
new partners are ordinary partners rows (source='signup').

VERIFY:
- E2E: a new giver signs up → partner row created with normalized phone + region block;
  one-time test gift lands as a contribution; choosing recurring writes a
  recurring_commitments row; duplicate email/phone flagged.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 10 — Recurring giving (Stripe subs + MoMo prefilled-invoice cron)

**Prereq**: Phases 6 and 8.

**Deliverable**: giving recurs. Card commitments auto-charge via Stripe; MoMo commitments run the **prefilled-invoice loop** (the transcript's workaround, verified against Paystack — Decision 0005): a monthly cron bills each pledge with a prefilled link so the partner only enters OTP+PIN.

**Prompt**:

```
Implement recurring giving on top of Phases 6 + 8.
Read docs/decisions.md 0005 (verified mechanism), db-schema.md §7 (recurring_commitments,
invoices), Phase 6 pipeline (promotion + invoice reconciliation).

1. Monthly cron (Vercel Cron route or Supabase scheduled function — pick one, document why):
   for each due recurring_commitments, create ONE invoices row for the period (unique
   (recurring_commitment_id, period_month) prevents double-billing).
2. Issue the prefilled charge:
   - MoMo: Paystack Charge API with mobile_money { phone, provider } from the partner
     record (amount prefilled) OR a Paystack Payment Request/Invoice; store payment_link;
     send it via Phase 8 messaging (WhatsApp→SMS). Invoice status → sent.
   - Card: Stripe subscription drives its own invoice.paid; mirror it into an invoices row.
3. Reconcile: the Phase 6 webhook marks the invoice paid + promotes a contribution. Cron
   NEVER marks paid optimistically.
4. Dunning: unpaid after N reminders (reminder_count) → a follow_up_task; expose per-cycle
   paid/unpaid on the partner profile and reports.

CONSTRAINTS: no stored MoMo mandate — every MoMo cycle is a fresh authorized charge.
Idempotent cron: re-running a period is inert. Money stays minor-units + numeric usd_equivalent.

VERIFY:
- Integration: cron generates exactly one invoice per due commitment per period; re-run
  inert; a simulated charge.success/paymentrequest.success flips the invoice to paid and
  writes a contribution; unpaid after N reminders → follow_up_task.
- E2E: a MoMo commitment's invoice shows a prefilled payment_link and a sent message; a
  Stripe subscription invoice.paid reconciles.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 11 — AI assistant (Claude on Vertex, read-only)

**Prereq**: Phase 6. **Can start in parallel from Phase 6.**

**Deliverable**: the chatbot the client expects — answering the board's questions from live data with citations, zero write capability. Model is Claude on GCP Vertex behind the AI SDK registry.

**Prompt**:

```
Implement the read-only AI analyst on top of Phase 6.
Read docs/design-spec.md §8 (Analyst row + guardrails), src/lib/ai/model-registry.ts,
docs/tech-stack.md §AI (Claude on Vertex), docs/decisions.md 0001 (read-only v1).

1. /ai streaming chat over AI SDK 7; model resolved via the registry (@ai-sdk/google-vertex,
   Claude on Vertex — GOOGLE_VERTEX_PROJECT/LOCATION + service-account). Staff-auth required.
2. Read-only tools (zod-schemad, on PrmRepository): searchPartners, getPartnerBrief,
   getRegionStats(month), getMonthlyCycleStatus(month), previewSegment, summarizeCampaign.
3. System prompt: ground every numeric claim in tool results, show underlying counts
   ("42 of 118 UK partners"); refuse actions (no such tools) and name the phase that adds them.
4. Log each run to ai_runs (user, tools, model, tokens/cost). Partner-page "Brief" button.

CONSTRAINTS: no mutation/send tools this phase. Tools respect caller auth (no service-role).
Aggregates, not row dumps.

VERIFY:
- E2E/integration: the five headline questions (partners per block; paid/unpaid this month;
  % active per block; contributions per block; trend vs last month) match /reports on the
  same seed data; an action request is declined; runs logged to ai_runs.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 12 — Monthly cycle & reports (snapshots, close)

**Prereq**: Phases 8 and 11.

**Deliverable**: the month closes itself into frozen per-region snapshots; `/reports` reads them; sequences and AI drafting (approval-gated) land here.

**Prompt**:

```
Implement month-close + reports on top of Phases 8 + 11.
Read docs/design-spec.md §5 (close semantics), §7 (governance), §8 (Drafter row),
db-schema.md (monthly_snapshots, sequence_*, approval_policies — §13).

1. monthly_snapshots migration + close job (cron): per-block frozen stats (partners, paid,
   unpaid, % active, USD totals, new, lapsed), guard against double-close, backfill command.
2. /reports month selector: snapshots for closed months, live compute for the current month,
   clearly labeled. Lapsed detection at close → follow_up_tasks (owner by region block).
3. Sequences (trigger-gated — build only when manual batches bottleneck): reminder/welcome/
   lapsed/pre-crusade; send steps require batch approval (Phase 8); pause/resume; idempotent
   step execution keyed by (run, partner, step).
4. AI drafting tools with an approval envelope: drafts land in a review queue → approving
   routes into the existing send pipeline. Template category 'prophet' requires a SECOND
   distinct approver (communication_batches.second_approved_by/_at).

CONSTRAINTS: snapshots immutable after close (corrections = adjustment records). AI drafts
never send — they enter the human approval pipeline. Sequences survive restarts.

VERIFY:
- Integration: simulated close freezes correct stats; later data changes don't alter them;
  assistant reads closed-month numbers matching /reports; sequence pause/resume no double-send.
- E2E: an unapproved AI draft and a single-approved prophet draft are both blocked from sending.
- Gate: typecheck && lint && test && build green.
```

---

## Phase 13 — Scale & hardening (regional RLS, 40k, call queue)

**Prereq**: Phase 12.

**Deliverable**: comfortable at 40,000 partners, multi-staff, ready for regional coordinators; production-grade webhook resilience and a tested restore.

**Prompt**:

```
Implement scale + hardening on top of Phase 12.
Read docs/design-spec.md §9/§12, docs/decisions.md 0005/0006 (RLS is the gate), existing
policies from Phase 3.

1. Region scoping: extend RLS with staff_country_assignments so a regional_coordinator only
   sees/writes in-scope partners (out-of-scope read → row invisible, write → RLS denies);
   admin UI for assignments.
2. Load: seed 40k realistic partners + 18 months of contributions; add pagination/
   virtualization on heavy lists; add indexes found under load; record measured budgets as
   as-built notes.
3. Call queue: /follow-up call mode ordered by attention tier + due date, script display,
   outcome capture, next-action scheduling.
4. Ops: webhook_dead_letters + replay tool (idempotency makes replay safe); backup/restore
   drill documented + run; audit-log coverage checklist; evaluate Meta Cloud API adapter;
   pawaPay only if rest-of-Africa volume justifies (Decision 0005).

CONSTRAINTS: no behavior change for non-coordinator roles; performance work stays inside
the repository (no forked data paths).

VERIFY:
- Integration/load: 40k seed within recorded budgets (e.g. p95 < 2s list render); a scoped
  coordinator fenced exactly (403 write / 404 read); replayed historical webhook batch → zero
  duplicate contributions.
- Ops: restore drill from backup on a scratch project documented step-by-step.
- Gate: typecheck && lint && test && build green.
```

---

## Working tips for the AI agent

- Always read the relevant docs in this folder BEFORE coding. They are short and load-bearing.
- **Tests are the completion gate, not optional.** Each phase's `VERIFY` block is the definition of done: Vitest for unit/integration, Playwright for E2E acceptance flows. A phase isn't finished until its `VERIFY` tests are green and `npm run typecheck && npm run lint && npm test && npm run build` all pass.
- **Integration tests need a database.** They run against a disposable Postgres / test Supabase project via `DATABASE_URL_TEST` (CI `postgres:16` service or local docker), migrated fresh from `supabase/migrations/`. Unit tests need no I/O; E2E needs `npx playwright install chromium` once.
- Provider specifics live behind adapters (`src/lib/data/`, `src/lib/payments/<provider>/`, `src/lib/messaging/<provider>/`) — UI and business logic import contracts only.
- Money is integer minor units + `numeric` `usd_equivalent` — never JS float arithmetic on amounts.
- Keep webhook/intake logs structured (provider, event reference, match outcome, status) so money movements are greppable.
