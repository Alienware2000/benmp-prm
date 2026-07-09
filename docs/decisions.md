# Decisions

One file, all decisions. Each entry: **what we decided → why → what we said no to.** Check here before relitigating something that looks arbitrary. New decisions get appended with the next number.

---

## 0001 — Foundation first, AI autonomy in stages

*2026-07-07*

**Decided**: build the PRM data foundation before AI workflows. AI capability grows in steps — read → draft → act → workflow — each step behind staff approval.

**Why**:
- **An AI over messy data confidently gives wrong answers.** One wrong "who paid this month" destroys the office's trust in the whole system, permanently.
- **The client's pain is operational, not conversational.** Reliable partner/giving records solve the stated problem; chat is the interface to them, not a substitute for them.
- **Approval gates make early AI safe to ship.** The assistant can appear early (which the client expects) because it can't touch anything until the data underneath earns trust.

**Said no to**: chatbot-first build (demos well, fails operationally) · Airtable/generic CRM (weak fit for crusades, prayer, regional coordinators, and AI governance).

---

## 0002 — Adapter-first everything

*2026-07-07*

**Decided**: data, payments, messaging, and AI models each sit behind a swappable adapter (`BENMP_DATA_PROVIDER`, `BENMP_PAYMENT_PROVIDER`, `BENMP_MESSAGING_PROVIDER`, model registry). The mock MVP ran with zero credentials.

**Why**:
- **Vendors were undecided; workflows weren't.** The board could validate the product on mocks while provider choices stayed open.
- **Provider swaps become cheap.** When Flutterwave was later demoted (see 0004), it cost a paragraph — not a rewrite.
- **It's what makes parallel work possible.** Payments and AI teams build against mocks/fixtures from day one and flip an env var when the real backend lands.

**Said no to**: committing to a database/provider before workflow validation · scattering provider SDKs through business logic.

---

## 0003 — Monthly cycle, region blocks, AI positioning

*2026-07-08*

**Decided**:
1. The **monthly cycle** is the core product loop: remind → receive → acknowledge → **close on the 1st** with a frozen per-region snapshot.
2. Reporting groups by **seven region blocks** — Ghana, Rest of Africa, Europe, UK, America, South America, Australia/Asia — as a configurable lookup (pending office confirmation). One block per partner, derived from country, overridable.
3. The **AI ships early but read-only first** (the analyst), gaining autonomy per 0001.

**Why**:
- **The month-end answer *is* the product.** "Who paid, per region, without asking any church" is the exact question the office can't answer today — sometimes for weeks.
- **Frozen snapshots keep history honest.** "How did March look?" must have one answer forever, even as data gets corrected later.
- **Blocks match how the office already manages** (from the board meetings); a lookup table means the list can change without a schema migration.
- **The client thinks of the product as "the AI".** It must be visible from the first demo — read-only makes that safe.

**Said no to**: country-level reporting as the primary grouping (blocks are the management unit; countries sit beneath) · hard-coded region enum.

---

## 0004 — Providers and platform

*2026-07-08*

> **Partially superseded by [0007](#0007--csv-only-payment-intake-no-live-payment-rails) (2026-07-09).** The Ghana rail (Paystack/Hubtel) and diaspora rail (Stripe) below are **removed** — the system takes no live payments. Supabase, clean CSV partner import, USD thresholds, messaging, and data-access rows still stand.

**Decided**:

| Area | Choice |
| --- | --- |
| Backend | **Supabase** (managed Postgres + auth + RLS), behind the repository adapter |
| Ghana rail | **Paystack** (charge API + cards), **Hubtel** for USSD |
| Diaspora rail | **Stripe** payment links — one-time *and* subscription |
| Messaging | **Twilio** pilot (WhatsApp/SMS) + **Resend** (email); Meta Cloud API is the long-term direct path |
| Partner data | **Clean CSV import** (office Excel + benmp.com export); this system becomes source of truth |
| Thresholds | **USD-equivalent at gift-date FX** ($60/yr active, $100 high-touch), admin-configurable |
| Data access | **All staff see all** initially; region scoping schema-ready but deferred |

**Why**:
- **Supabase**: the team debated MySQL vs Supabase vs GCP Postgres — but "Supabase vs Postgres" is a false choice (Supabase *is* Postgres), and it bundles the auth/RLS/storage we'd otherwise assemble by hand. MySQL adds nothing for a relational, permission-heavy domain. The adapter keeps Neon/Aurora as real exits.
- **Paystack over Flutterwave**: Bank of Ghana suspended Flutterwave's remittance partnerships (Sept 2025) and its Kenya licensing is unconfirmed — a ministry must be reputationally conservative. Paystack covers the same three Ghana networks at 1.95%, explicitly supports nonprofits/religious bodies, and is Stripe-owned (consistent engineering with the diaspora rail).
- **Stripe with both modes**: subscriptions give true auto-recurring for card countries, but not everyone can or will subscribe — so one-time links stay alongside.
- **Twilio first**: fastest route to actually sending; Meta Business verification takes weeks and runs in parallel; the adapter makes the later swap cheap.
- **Clean import**: two-way sync with the legacy PHP site is a permanent complexity tax and a classic data-corruption source. Import once, own the truth.
- **USD thresholds**: works everywhere immediately with no board coordination; local per-block amounts can be pinned later because thresholds live in config, not code.

**Said no to**: Flutterwave as anchor (regulatory flags) · direct MTN MoMo API (manual per-country KYC, MTN-only, no fee advantage at our volume) · live sync with benmp.com · region-scoped access on day one (build it when coordinators actually onboard).

---

## 0005 — Merchant-first channels + remittance handling

*2026-07-08, amended same day*

> **Superseded by [0007](#0007--csv-only-payment-intake-no-live-payment-rails) (2026-07-09).** The three published giving channels, all webhook/merchant machinery, and the prefilled-invoice recurring loop below are **removed**. The one durable idea that survives — a CSV/statement import as the trustworthy ledger — is now the *sole* intake. Kept for the reasoning (why SMS parsing and consumer-wallet detection were rejected), which still holds.

**Decided**: publish **three giving channels**, everything webhook-confirmed where physics allows:

| Channel | Serves | How the system knows |
| --- | --- | --- |
| Ghana merchant USSD code (Hubtel `*713*NNN#`) | Ghana — the majority of volume | Signed webhook, seconds |
| Stripe giving link | Card countries (Europe/UK/America) | Signed webhook, seconds |
| Ministry-registered merchant-tier wallet number | Remittance apps worldwide (Sendwave, WorldRemit, Wise…) | **Daily statement import** |

**SMS parsing is permanently rejected** as an intake mechanism. pawaPay (rest-of-Africa in-country rail) deferred.

**Why**:
- **Consumer wallets have no payment-notification API.** Money landing in a wallet tells no software anything — the only automatic detection is parsing the SMS on the SIM-holding phone, which is hardware-dependent, format-fragile per network/country, unverifiable, and exactly where the office prototype got stuck. Merchant rails exist precisely to notify a server with signed, verifiable webhooks.
- **The wallet number must still exist** because remittance apps can only deliver to wallet numbers — drop it and the diaspora remittance channel dies. Statement import is its trustworthy ledger; the office is never more than ~24h behind.
- **Recurring MoMo mandates don't exist anywhere** (verified against provider docs) — so the monthly reminder *is* the recurring mechanism. This validates the monthly-cycle design rather than complicating it.

**Verified recurring mechanism (2026-07-09, confirmed against live Paystack docs)**: Paystack reusable authorizations exist only for **cards (all markets)** and **direct debit (Nigeria only)** — Ghana MoMo authorizations are one-time, and the Subscriptions API supports **card + Nigerian direct debit only**. So MoMo recurring is impossible as an auto-pull. The mechanism we build (the transcript's "invoice database + cron" workaround): a monthly **cron** reads each `recurring_commitments` pledge → writes an `invoices` row → issues a **server-side prefilled** payment (Paystack **Charge API** with `mobile_money {phone, provider}` from the partner record, or a Paystack **Payment Request/Invoice** link) so the partner **only enters OTP+PIN** → the `charge.success`/`paymentrequest.success` webhook marks the invoice paid and promotes a contribution. Cards (Stripe subscriptions / `invoice.paid`) remain the only zero-touch rail. New `invoices` table + reconciled `recurring_commitments` land in Phase 1 (see `db-schema.md` §7); the cron loop is Phase 10. Sources: paystack.com/docs/payments/recurring-charges, /subscriptions, /api/charge, /blog Payment Requests.
- **Merchant-tier registration is non-negotiable at scale**: 40k × $5/month breaches consumer wallet caps, and ministry money should settle to BENMP's bank with an audit trail, not sit on one person's phone.

**Said no to**: bare wallet number as the main channel (blind + fragile) · SMS parsing (rejected as ledger forever) · one provider for everything (none covers Ghana USSD + pan-Africa MoMo + diaspora cards).

**Deferred with triggers**:
- **WhatsApp claim loop** (partner messages "I gave" → instant provisional thank-you → claim auto-matches the statement) — build only if the office reports remittance-app giving is a significant share.
- **pawaPay** — add only if rest-of-Africa in-country volume justifies upgrading those partners from the wallet channel to a true merchant rail.

---

## 0006 — Full tech stack: just Supabase + Claude-on-Vertex

*2026-07-09*

**Decided** (from the Jmills meeting transcript; full detail in `docs/tech-stack.md`):
1. **Next.js full-stack in TypeScript**, deployed on **Vercel** — the REST API is Next route handlers, **not** a separate Python/FastAPI service.
2. **Data layer is Supabase directly** — `@supabase/supabase-js` + `@supabase/ssr` behind `PrmRepository`, schema as SQL migrations under `supabase/migrations/`, types via `supabase gen types typescript`. **No ORM** (no Prisma, no Drizzle).
3. AI model is **Anthropic Claude via GCP Vertex AI**, behind the AI SDK model registry.

**Why**:
- **Next.js full-stack**: the tech lead explicitly rejected Python/FastAPI — "it will not be in Python… Next.js is both front-end and back-end." One deployable, one language, one type system end-to-end.
- **Just Supabase (reversed from an interim Prisma decision)**: it's the shipped codebase (zero rework), and — decisively — the Supabase client runs queries under the user's JWT so **RLS works as the authorization gate exactly as `db-schema.md`/`security.md` already designed**. An ORM (Prisma) would connect as one role and bypass RLS, forcing authorization up into the repository layer for no benefit here. `supabase gen types` gives type safety without an ORM; money stays integer minor units + `numeric` (returned as strings, no float). The only thing that had argued for Prisma — a "profile" NPM package said to require it — is **not a hard dependency** (nothing in the repo uses it; the partner profile is built natively on the existing `partners` tables).
- **Claude on Vertex**: "Vertex already has Claude" — consolidates the AI credential on GCP while the registry keeps a swap to the direct Anthropic API cheap.

**Consequences**: RLS is the primary write gate (per-role policies in the migration that creates each table), restoring 0004's design; server actions still validate but don't replace RLS. `docs/db-schema.md` stays raw-SQL/Supabase; the new `invoices` table + reconciled `recurring_commitments` (the recurring-giving loop) are ordinary Supabase migrations.

**Said no to**: Python/FastAPI backend · Prisma / Drizzle / any ORM (the Supabase client + RLS covers it with less complexity) · direct Anthropic API as the primary path (Vertex chosen; direct stays a config-level fallback).

**Trigger to revisit**: only if the "profile" NPM package (or similar) turns out to be mandatory *and* genuinely Prisma-only.

---

## 0007 — CSV-only payment intake, no live payment rails

*2026-07-09*

**Decided**: the system takes **no live payments and integrates no payment provider.** There are no payment-provider webhooks, no signature verification, no hosted charges, and no recurring-charge/prefilled-invoice loop. Instead:

1. **The sole money-intake path is a CSV upload.** Staff upload, on the backend, a CSV of payments for a period. Each row becomes an immutable `payment_events` row (source `csv_import`), exactly as manual finance entry already does.
2. **Matching is unchanged and is now the whole job.** Rows match against the partner database by normalized phone (then email/reference); matched rows promote to `contributions`; unmatched/ambiguous rows go to reconciliation for a human to match, create-partner, or dismiss.
3. **"Paid" means a contribution exists for the period.** Once a row is matched, the partner is ticked as having paid for that period; the monthly cycle, region reports, active-year and high-touch classification all read from those contributions as before.
4. **`recurring_commitments` stays as pledge records** (each partner's expected monthly amount/cadence) — the thing that powers "who hasn't paid this month" and the reminder list. But the **`invoices` table and the cron that issued prefilled charges are removed** — there is nothing to charge.

This amends **0004** (removes the Ghana/diaspora payment rails) and supersedes **0005** (removes the three channels and the recurring-charge loop; keeps only its statement-import idea, now promoted to the only intake). The **adapter-first** principle (0002) still holds for **data, messaging, and AI**; the *payment* adapter is retired rather than swapped.

**Why**:
- **It matches how the office actually reconciles.** Money lands wherever it lands (wallets, bank, remittance apps); the office already exports a statement/CSV per period. Turning that CSV into matched, ticked contributions *is* the operational win — the same "who paid, per region, without asking any church" answer, with none of the merchant-onboarding, KYC, or webhook-security surface.
- **It removes the biggest cost and risk centre.** No merchant-tier registration, no Paystack/Stripe/Hubtel business docs, no signature/replay security, no provider outages, no PCI-adjacent surface. The one-week path to value stops depending on calendar-time provider approvals.
- **Nothing important is lost.** Contributions still carry amount/currency/date/method, so all reporting, thresholds, thank-yous, and follow-up work unchanged. Reconciliation — already built for the remittance channel — becomes the primary workflow rather than the exception.

**Said no to**: Paystack / Hubtel / Stripe / any payment provider · payment webhooks and signature verification · hosted/prefilled charges and the `invoices` cron loop · SMS parsing (still rejected, 0005) · a boolean "paid" flag with no amount (would break amount-based reporting, thresholds, and high-touch).

**Trigger to revisit**: the office decides it wants money to land *inside* the app with instant confirmation (a real merchant rail) rather than reconciled from a periodic CSV — at which point re-introduce a payment adapter behind the retained `payment_events` pipeline.
