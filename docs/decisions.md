# Decisions

One file, all decisions. Each entry: **what we decided → why → what we said no to.** Check here before relitigating something that looks arbitrary. New decisions get appended with the next number.

---

## 0001 — Foundation first, AI autonomy in stages

_2026-07-07_

**Decided**: build the PRM data foundation before AI workflows. AI capability grows in steps — read → draft → act → workflow — each step behind staff approval.

**Why**:

- **An AI over messy data confidently gives wrong answers.** One wrong "who paid this month" destroys the office's trust in the whole system, permanently.
- **The client's pain is operational, not conversational.** Reliable partner/giving records solve the stated problem; chat is the interface to them, not a substitute for them.
- **Approval gates make early AI safe to ship.** The assistant can appear early (which the client expects) because it can't touch anything until the data underneath earns trust.

**Said no to**: chatbot-first build (demos well, fails operationally) · Airtable/generic CRM (weak fit for crusades, prayer, regional coordinators, and AI governance).

---

## 0002 — Adapter-first everything

_2026-07-07_

**Decided**: data, payments, messaging, and AI models each sit behind a swappable adapter (`BENMP_DATA_PROVIDER`, `BENMP_PAYMENT_PROVIDER`, `BENMP_MESSAGING_PROVIDER`, model registry). The mock MVP ran with zero credentials.

**Why**:

- **Vendors were undecided; workflows weren't.** The board could validate the product on mocks while provider choices stayed open.
- **Provider swaps become cheap.** When Flutterwave was later demoted (see 0004), it cost a paragraph — not a rewrite.
- **It's what makes parallel work possible.** Payments and AI teams build against mocks/fixtures from day one and flip an env var when the real backend lands.

**Said no to**: committing to a database/provider before workflow validation · scattering provider SDKs through business logic.

---

## 0003 — Monthly cycle, region blocks, AI positioning

_2026-07-08_

**Decided**:

1. The **monthly cycle** is the core product loop: remind → receive → acknowledge → **close on the 1st** with a frozen per-region snapshot.
2. Reporting groups by **seven region blocks** — Ghana, Rest of Africa, Europe, UK, America, South America, Australia/Asia — as a configurable lookup (pending office confirmation). One block per partner, derived from country, overridable.
3. The **AI ships early but read-only first** (the analyst), gaining autonomy per 0001.

**Why**:

- **The month-end answer _is_ the product.** "Who paid, per region, without asking any church" is the exact question the office can't answer today — sometimes for weeks.
- **Frozen snapshots keep history honest.** "How did March look?" must have one answer forever, even as data gets corrected later.
- **Blocks match how the office already manages** (from the board meetings); a lookup table means the list can change without a schema migration.
- **The client thinks of the product as "the AI".** It must be visible from the first demo — read-only makes that safe.

**Said no to**: country-level reporting as the primary grouping (blocks are the management unit; countries sit beneath) · hard-coded region enum.

---

## 0004 — Providers and platform

_2026-07-08_

> **Partially superseded by [0007](#0007--csv-only-payment-intake-no-live-payment-rails) (2026-07-09).** The Ghana rail (Paystack/Hubtel) and diaspora rail (Stripe) below are **removed** — the system takes no live payments. Supabase, clean CSV partner import, USD thresholds, messaging, and data-access rows still stand.

**Decided**:

| Area          | Choice                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Backend       | **Supabase** (managed Postgres + auth + RLS), behind the repository adapter                       |
| Ghana rail    | **Paystack** (charge API + cards), **Hubtel** for USSD                                            |
| Diaspora rail | **Stripe** payment links — one-time _and_ subscription                                            |
| Messaging     | **Twilio** pilot (WhatsApp/SMS) + **Resend** (email); Meta Cloud API is the long-term direct path |
| Partner data  | **Clean CSV import** (office Excel + benmp.com export); this system becomes source of truth       |
| Thresholds    | **USD-equivalent at gift-date FX** ($60/yr active, $100 high-touch), admin-configurable           |
| Data access   | **All staff see all** initially; region scoping schema-ready but deferred                         |

**Why**:

- **Supabase**: the team debated MySQL vs Supabase vs GCP Postgres — but "Supabase vs Postgres" is a false choice (Supabase _is_ Postgres), and it bundles the auth/RLS/storage we'd otherwise assemble by hand. MySQL adds nothing for a relational, permission-heavy domain. The adapter keeps Neon/Aurora as real exits.
- **Paystack over Flutterwave**: Bank of Ghana suspended Flutterwave's remittance partnerships (Sept 2025) and its Kenya licensing is unconfirmed — a ministry must be reputationally conservative. Paystack covers the same three Ghana networks at 1.95%, explicitly supports nonprofits/religious bodies, and is Stripe-owned (consistent engineering with the diaspora rail).
- **Stripe with both modes**: subscriptions give true auto-recurring for card countries, but not everyone can or will subscribe — so one-time links stay alongside.
- **Twilio first**: fastest route to actually sending; Meta Business verification takes weeks and runs in parallel; the adapter makes the later swap cheap.
- **Clean import**: two-way sync with the legacy PHP site is a permanent complexity tax and a classic data-corruption source. Import once, own the truth.
- **USD thresholds**: works everywhere immediately with no board coordination; local per-block amounts can be pinned later because thresholds live in config, not code.

**Said no to**: Flutterwave as anchor (regulatory flags) · direct MTN MoMo API (manual per-country KYC, MTN-only, no fee advantage at our volume) · live sync with benmp.com · region-scoped access on day one (build it when coordinators actually onboard).

---

## 0005 — Merchant-first channels + remittance handling

_2026-07-08, amended same day_

> **Superseded by [0007](#0007--csv-only-payment-intake-no-live-payment-rails) (2026-07-09).** The three published giving channels, all webhook/merchant machinery, and the prefilled-invoice recurring loop below are **removed**. The one durable idea that survives — a CSV/statement import as the trustworthy ledger — is now the _sole_ intake. Kept for the reasoning (why SMS parsing and consumer-wallet detection were rejected), which still holds.

**Decided**: publish **three giving channels**, everything webhook-confirmed where physics allows:

| Channel                                         | Serves                                                  | How the system knows       |
| ----------------------------------------------- | ------------------------------------------------------- | -------------------------- |
| Ghana merchant USSD code (Hubtel `*713*NNN#`)   | Ghana — the majority of volume                          | Signed webhook, seconds    |
| Stripe giving link                              | Card countries (Europe/UK/America)                      | Signed webhook, seconds    |
| Ministry-registered merchant-tier wallet number | Remittance apps worldwide (Sendwave, WorldRemit, Wise…) | **Daily statement import** |

**SMS parsing is permanently rejected** as an intake mechanism. pawaPay (rest-of-Africa in-country rail) deferred.

**Why**:

- **Consumer wallets have no payment-notification API.** Money landing in a wallet tells no software anything — the only automatic detection is parsing the SMS on the SIM-holding phone, which is hardware-dependent, format-fragile per network/country, unverifiable, and exactly where the office prototype got stuck. Merchant rails exist precisely to notify a server with signed, verifiable webhooks.
- **The wallet number must still exist** because remittance apps can only deliver to wallet numbers — drop it and the diaspora remittance channel dies. Statement import is its trustworthy ledger; the office is never more than ~24h behind.
- **Recurring MoMo mandates don't exist anywhere** (verified against provider docs) — so the monthly reminder _is_ the recurring mechanism. This validates the monthly-cycle design rather than complicating it.

**Verified recurring mechanism (2026-07-09, confirmed against live Paystack docs)**: Paystack reusable authorizations exist only for **cards (all markets)** and **direct debit (Nigeria only)** — Ghana MoMo authorizations are one-time, and the Subscriptions API supports **card + Nigerian direct debit only**. So MoMo recurring is impossible as an auto-pull. The mechanism we build (the transcript's "invoice database + cron" workaround): a monthly **cron** reads each `recurring_commitments` pledge → writes an `invoices` row → issues a **server-side prefilled** payment (Paystack **Charge API** with `mobile_money {phone, provider}` from the partner record, or a Paystack **Payment Request/Invoice** link) so the partner **only enters OTP+PIN** → the `charge.success`/`paymentrequest.success` webhook marks the invoice paid and promotes a contribution. Cards (Stripe subscriptions / `invoice.paid`) remain the only zero-touch rail. New `invoices` table + reconciled `recurring_commitments` land in Phase 1 (see `db-schema.md` §7); the cron loop is Phase 10. Sources: paystack.com/docs/payments/recurring-charges, /subscriptions, /api/charge, /blog Payment Requests.

- **Merchant-tier registration is non-negotiable at scale**: 40k × $5/month breaches consumer wallet caps, and ministry money should settle to BENMP's bank with an audit trail, not sit on one person's phone.

**Said no to**: bare wallet number as the main channel (blind + fragile) · SMS parsing (rejected as ledger forever) · one provider for everything (none covers Ghana USSD + pan-Africa MoMo + diaspora cards).

**Deferred with triggers**:

- **WhatsApp claim loop** (partner messages "I gave" → instant provisional thank-you → claim auto-matches the statement) — build only if the office reports remittance-app giving is a significant share.
- **pawaPay** — add only if rest-of-Africa in-country volume justifies upgrading those partners from the wallet channel to a true merchant rail.

---

## 0006 — Full tech stack: just Supabase + Claude-on-Vertex

_2026-07-09_

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

**Trigger to revisit**: only if the "profile" NPM package (or similar) turns out to be mandatory _and_ genuinely Prisma-only.

---

## 0007 — CSV-only payment intake, no live payment rails

_2026-07-09_

**Decided**: the system takes **no live payments and integrates no payment provider.** There are no payment-provider webhooks, no signature verification, no hosted charges, and no recurring-charge/prefilled-invoice loop. Instead:

1. **The sole money-intake path is a CSV upload.** Staff upload, on the backend, a CSV of payments for a period. Each row becomes an immutable `payment_events` row (source `csv_import`), exactly as manual finance entry already does.
2. **Matching is unchanged and is now the whole job.** Rows match against the partner database by normalized phone (then email/reference); matched rows promote to `contributions`; unmatched/ambiguous rows go to reconciliation for a human to match, create-partner, or dismiss.
3. **"Paid" means a contribution exists for the period.** Once a row is matched, the partner is ticked as having paid for that period; the monthly cycle, region reports, active-year and high-touch classification all read from those contributions as before.
4. **`recurring_commitments` stays as pledge records** (each partner's expected monthly amount/cadence) — the thing that powers "who hasn't paid this month" and the reminder list. But the **`invoices` table and the cron that issued prefilled charges are removed** — there is nothing to charge.

This amends **0004** (removes the Ghana/diaspora payment rails) and supersedes **0005** (removes the three channels and the recurring-charge loop; keeps only its statement-import idea, now promoted to the only intake). The **adapter-first** principle (0002) still holds for **data, messaging, and AI**; the _payment_ adapter is retired rather than swapped.

**Why**:

- **It matches how the office actually reconciles.** Money lands wherever it lands (wallets, bank, remittance apps); the office already exports a statement/CSV per period. Turning that CSV into matched, ticked contributions _is_ the operational win — the same "who paid, per region, without asking any church" answer, with none of the merchant-onboarding, KYC, or webhook-security surface.
- **It removes the biggest cost and risk centre.** No merchant-tier registration, no Paystack/Stripe/Hubtel business docs, no signature/replay security, no provider outages, no PCI-adjacent surface. The one-week path to value stops depending on calendar-time provider approvals.
- **Nothing important is lost.** Contributions still carry amount/currency/date/method, so all reporting, thresholds, thank-yous, and follow-up work unchanged. Reconciliation — already built for the remittance channel — becomes the primary workflow rather than the exception.

**Said no to**: Paystack / Hubtel / Stripe / any payment provider · payment webhooks and signature verification · hosted/prefilled charges and the `invoices` cron loop · SMS parsing (still rejected, 0005) · a boolean "paid" flag with no amount (would break amount-based reporting, thresholds, and high-touch).

**Documented target (per the Jmills planning meeting — where payments go next, not "never")**: CSV import is **step one and the permanent reconciliation floor**, not the end state. The intended live-giving flow is **pre-filled Paystack links** (the monthly reminder carries a link pre-populated from the partner's profile — name + expected amount — they tap, choose MoMo, pay) for Africa, and **Stripe subscriptions** (monitorable by webhook) for overseas cards, re-introducing the `invoices`/reminder loop then. Both land behind the retained `payment_events` pipeline, so nothing built now is wasted. Sequencing only: CSV-first because it has zero calendar-time blockers; the link-based flow follows once the foundation ships.

**Trigger to build the target**: the CSV MVP is shipped and the office wants giving to originate _from_ the app (reminder → link → pay) rather than only be reconciled after the fact.

---

## 0008 — POC scope: Ghana + MoMo, Qodesh BENMP

_2026-07-10_

**Decided**: the first deliverable is a proof of concept scoped to **Ghana, MoMo only, on Qodesh BENMP** (not the full multi-region MVP). Within that POC:

1. **Skip GDPR** — once the data is provisioned, POC data governance is out of scope (no Europe partners in play).
2. **Skip registration** — no new-partner sign-up flow; work from the provisioned registration + payment data.
3. **Bishop Ebo's rule (load-bearing)**: in the reconciliation of the registration table against the payment table, a person who **has paid but is not on the registration table is still included and messaged like everyone else** — the payment makes them a partner. Reconciliation therefore has three buckets: registered-and-paid, **paid-but-unregistered (include + message)**, and registered-but-unpaid (the reminder targets). Implemented in `src/lib/reconcile.ts`. _(2026-07-11)_ Unregistered payments are grouped by phone — one person gets **one** thank-you covering their total (VIP tier judged on the total), same as registered partners; no-phone payments stay separate entries since there is nothing to group by.
4. **AI model**: use **Gemini 2.5** on the fresh Vertex account (Claude isn't available immediately on a new GCP project; no need to wait for it for the POC).
5. **No cron / no subscriptions**: MoMo is push, so there is no recurring-charge model to schedule. Reminders are a **basic event-driven script** — when a due date passes and no payment is recognized for a partner, send a message. (This is the registered-but-unpaid bucket above.)
6. **Real-send safety gates** _(2026-07-11)_: three gates sit in front of any real message. (a) **Statement-noise filter**: bank/interop rows on the MoMo statement ("Ecobank MobileApp", "INTEROPERABILITY PULL [OVA]", "Interpush OVA", "Quickpay pull", "CalSEND", "ZenithSend") are real money but not people — kept in giving totals, excluded from people counts, **never messaged**; a fourth reconcile bucket `statementRows` (in `src/lib/reconcile.ts`) sets them aside for finance review. Phone-match wins over the name check, so a registered partner paying via bank rails stays matched. (b) **Opt-outs**: the Supabase `opt_outs` table is enforced in both the send preview and the send loop. (c) **Allowlist training wheels**: when `BENMP_SEND_ALLOWLIST` is set (comma/space-separated numbers), real sends only reach those numbers — lets Twilio go live with zero blast risk; delete the variable when leadership approves full sends.

**Why**: proves the core loop (reconcile → who paid / who didn't / who paid unregistered → message) on one campus with real data, with zero calendar-time blockers (no merchant onboarding, no GDPR build, no Claude-on-Vertex wait, no cron infra). Everything here is a narrowing of scope, not a new direction — the full MVP (0004–0007) resumes after the POC proves out.

**Said no to**: registration/sign-up in the POC · GDPR build in the POC · waiting on Claude-on-Vertex · cron/subscription scheduling · dropping unregistered payers (Bishop Ebo's rule keeps them).

## 0009 — Directory + giving pages on the standing `partners` table

_2026-07-21_

**Decided**: the POC grows from one console page to three — the existing ask-first console (`/poc`), a **partner directory** (`/poc/directory`), and a **giving ledger** (`/poc/giving`). All three live under `/poc` so `src/proxy.ts` keeps gating them; nothing moves to a top-level route while the pre-POC shell is still redirected away.

1. **Two partner populations, one table.** `partners` (15,329 rows) holds the 927 Qodesh registrants **and** ~14,400 branch members. Phones live in `whatsapp_number` (already E.164), branch lives in `church`. The Qodesh cohort carried a null branch, so its giving reported as unattributed; backfilled to `'Qodesh'` in `supabase/poc/0002_qodesh_branch_and_test_partner.sql`.
2. **The directory reads `partners`, the console reads `registrations`.** They answer different questions: the console reconciles one campaign period, the directory is the standing address book staff search to reach _one_ person. No attempt to merge them for the POC.
3. **Branch on giving is derived, not stored.** `payments` has no branch column and no FK to a partner. Branch is resolved by matching `payments.payer_phone_e164` → `partners.whatsapp_number`. Giving that matches no partner is bucketed as **Unattributed** and still counted, so a filtered total always reconciles to the ledger total. As of the backfill: GHS 4,125 of GHS 19,794 attributes to a branch; the remaining 115 payer phones are givers not yet on any partner record.
4. **Directory sends are on demand only.** `POST /api/poc/directory/send` previews by default and dispatches only on `confirm: true`. Recipients are re-read from the database by id rather than trusted from the request body, so a tampered payload cannot redirect a message. The 0008 §6 gates (opt-outs, allowlist) and the `sent_messages` audit apply unchanged. A new `direct` message kind keeps these out of the thank-you/reminder counts.
5. **PostgREST paging is mandatory above 1000 rows.** Supabase caps every response at 1000 rows and does so _silently_ — `limit=20000` returns 1000 with no error. Any read spanning the whole `partners` table pages via `fetchAllRows()` (`src/lib/poc/directory.ts`). This was a live bug: the branch map saw only the first 1000 partners and reported all Qodesh giving as unattributed.

6. **Branch names are canonicalised at read time** _(2026-07-21)_: the source sheets spell one branch many ways — `Mankessim`/`MANKESSIM`, `Kent City` in six casings, `Tema Comm 22`/`Tema Comm. 22`, `NSAWAM`/`NSAWAM .`. Left alone these read as separate branches, splitting both the filter list and the giving subtotals (`Asokwa` was reported as two branches of 372 and 140). `normalizeBranchKey()` (uppercase, strip accents/punctuation, collapse spaces) groups the spellings; the label shown is the **most-used** spelling, not an invented canonical form, so staff recognise it. 682 raw values collapse to 552. The directory filter matches every variant via `church=in.(...)`, so picking a branch returns all its partners. This is a **read-time** fix — the underlying rows are untouched, pending a decision on cleaning the column itself.

7. **Confirmed branch merges are an explicit list, never fuzzy matching** _(2026-07-21)_: normalization catches case/punctuation, but not real misspellings (`MIGTHY GOD CATHEDRAL` vs `MIGHTY GOD CATHEDRAL` — 110 partners split near-evenly), letter swaps (`ASSIN FOSO`/`ASSIN FOSU`), or decorative qualifiers (`Bunkpurugu` / `Bunkpurugu Mission`). A similarity scan proposed 117 candidate pairs; **staff confirmed each one individually** and the accepted merges live in `BRANCH_MERGES` (`src/lib/poc/directory.ts`). No distance threshold runs at runtime: any threshold loose enough to merge `MIGTHY`/`MIGHTY` also merges `NEW TAFO`/`OLD TAFO`, `Savelugu north`/`south`, `BEREKUM`/`Berekuso` and `ENCHI`/`Wenchi` — all separate branches. A test asserts those stay apart, so a future merge can't silently combine two real congregations. `Qodesh` (928) and `QADISH` (381) are two characters apart but were **confirmed by staff as separate branches** (2026-07-21) and must never be merged.

8. **Sense gate on partner names** _(2026-07-21)_: `full_name` is not guaranteed to hold a name. `isSensibleName()` rejects the `"No Name"` placeholder, values with fewer than two letters (`"1.0"`), and short-prefix-plus-digits reference codes (`"FL73"`). Rejected values render as "Unknown" and receive a neutral greeting rather than being interpolated into a message. Applied to the giving ledger's payer names too, since they come from the same class of source data. Deliberately narrow: the code rule is anchored so a real name containing a digit still passes.

9. **A record without a phone or a usable name is not a partner** _(2026-07-21)_: staff decided the table should hold only reachable, identifiable people. Two deletions, each archived to `public.partners_archive` with a runnable undo: **2,128** rows with a blank `whatsapp_number` (migration 0003) and **45** column-shifted rows with no usable name (migration 0004, confirmed to have zero giving before removal). 15,329 -> 13,156 partners; branch count 537 -> 515; the giving ledger is unchanged at GHS 19,794 since none of the removed records matched a payment. Rows with a _non-phone value_ in `whatsapp_number` were deliberately excluded from 0003 so recoverable numbers weren't discarded before that check ran.

**Why**: staff asked for two things the console can't do — find a specific partner and message them, and interrogate giving by date/name/branch with a total that follows the filter. Both are read paths over data already provisioned; neither needs new intake.

**Said no to**: rewriting `partners.church` in place (read-time grouping first, so nothing is lost while the canonical branch list is still unconfirmed) · a top-level `/directory` route (would mean loosening the proxy gate) · fuzzy name-matching payments to partners for branch attribution (mis-attributes money; phone match only) · hiding unattributed giving to make the branch breakdown look complete.

## 0010 — WaliChat for the WhatsApp pilot

_2026-07-24_

**Decided**: use **WaliChat** as the current WhatsApp provider for the BENMP-owned business number, through the existing `MessagingAdapter` (`BENMP_MESSAGING_PROVIDER=wali`). This is a pilot provider choice, not a coupling: Meta Cloud API remains the long-term direct path and the other adapters remain available.

1. The Wali API key and device ID are server-only environment variables. They never enter client bundles, logs, or git.
2. All sends use the existing application workflow. Preview is the default; a real send requires explicit confirmation and still passes the opt-out and `BENMP_SEND_ALLOWLIST` gates.
3. Every attempted result is written to `sent_messages`, including skipped and failed sends.
4. The current BENMP sender uses Wali's operative web connector, so it can initiate the personalized acknowledgement without requiring the recipient to message first. If the sender moves to Meta Cloud API later, approved templates and Meta's customer-service window rules apply.
5. The local `npm run wali:check` command verifies that the configured BENMP sender is operative without sending a message.

**Why**: BENMP now controls a working WhatsApp Business number and Wali exposes it through an authenticated API. That removes the trial-sandbox and onboarding blockers encountered with the earlier providers while preserving the adapter boundary and the application's safety controls.

**Said no to**: bypassing the application with dashboard-only broadcasts · committing credentials · removing the allowlist for the first live test · rewriting messaging around Wali-specific concepts · treating a successful API request as delivery confirmation.

## 0011 — One messaging workspace; Giving stays a ledger

_2026-07-25_

**Decided**: staff compose and send from one `/poc/messages` workspace. Its two recipient modes are **Single number** (any valid international WhatsApp number) and **Choose partners** (search and select records already in `partners`). The old directory and acknowledgement-test URLs redirect into the matching Messages mode instead of maintaining duplicate sending surfaces.

Giving remains the financial ledger: filter gifts, inspect totals, and identify unattributed records. A person-level gift has a **Thank** action that opens Messages with the giver, destination and personalized amount-based thank-you prefilled; staff review and send it there. Statement-only rows cannot be messaged.

The allowlist is now an optional operational switch rather than a product limitation. When configured it still restricts delivery; when unset, any valid international destination may be used. Opt-outs, explicit confirmation, provider attachment checks, idempotency and message auditing remain mandatory in both recipient modes.

**Why**: separate money review from communication while giving staff one predictable place to contact people. This removes redundant pages without removing partner search or the safety controls around real sends.

---

## 0012 — Region import: Africa/international/Italy partner directories

_2026-07-28_

**Decided**: load the office's three new directory files (`AFRICA REDACTED.xlsx`, `INTL REDACTED.xlsx`, `ITALY REDACTED.xlsx` — 34 African countries, 33 international countries/territories, Italy) into `partners` as directory-only rows, alongside the Ghana population (Decision 0008/0009), via `scripts/load-region-partners.ts`. 12,936 rows loaded, tagged `source = 'region_import_<file>_<sheet>'`; 3,864 rejected (logged with reason, never silently dropped: 3,267 missing phone, 553 unrecognized phone shape, 44 missing name); 653 exact duplicates deduped.

1. **`country` is a first-class field, distinct from `church` (the branch)** — every partner gets an explicit country derived from the sheet it came from, never inferred from the phone number.
2. **Phone calling codes are ITU facts (`src/lib/calling-codes.ts`); national-number lengths are calibrated from each sheet's own data, not memorized.** Hand-authoring a fixed digit-length table per country from memory was the exact "sloppy country code" failure mode to avoid — real spreadsheets mix formats, and a wrong static assumption would silently produce a plausible-looking but incorrect E.164 number. `calibrateNsnLengths` derives the valid lengths empirically per country before any number is normalized; a diaspora number written in a different country's format falls back through every other country's own calibrated lengths (common here — BENMP is Ghana-based, so Ghanaian numbers turn up across several African sheets). Anything matching no recognized shape is rejected and logged, not guessed. `src/lib/phone.ts` gained the general `normalizePhoneForCallingCode` primitive; the Ghana-specific `normalizePhone` now delegates to it (behavior unchanged, verified by its existing test suite).
3. **Italy's Amount/Payment Type columns are preserved as free-text `notes`, not structured giving.** No CSV-import/reconciliation path exists for non-Ghana money (Decision 0007); inventing one here was out of scope.
4. **This invalidates a stated precondition of Decision 0008.** 0008 skipped GDPR because "no Europe partners in play." This import adds Italy, France, Germany, Austria, Belgium, Hungary, Netherlands, Portugal, Spain, Sweden, Switzerland, and the UK. GDPR scoping is now a genuine open item, not a deferred one — it should be addressed before this data is used beyond internal staff directory lookup.

**Why**: the office provided real partner lists beyond Ghana; loading them directory-only (name/phone/branch/country) follows the exact pattern already established for the Ghana branch import, without pretending the giving/reconciliation or GDPR questions are answered.

**Said no to**: guessing national-number lengths from memory per country · dropping unparseable rows instead of logging them · building Italy giving reconciliation now (no CSV-import path exists for it) · silently proceeding as if 0008's GDPR deferral still holds.

**Follow-up (2026-07-28, same day)**: doubling `partners` (13,156 → 26,092) exposed a latent perf issue — `/poc/directory` and `/poc/giving` each did a full paginated table scan (27 sequential PostgREST round-trips at this size) on _every_ page load, just to build a branch dropdown and a phone→branch lookup that only change on import. Added `memoWithTtl` (`src/lib/poc/db.ts`) and cached wrappers `listBranchGroupsCached`/`loadBranchByPhoneCached` (60s TTL); measured 2.5–2.9s → 0ms on a warm hit. The actual paginated/filtered searches are untouched (still per-request, must reflect query params).

---

## 0013 — Calls tab, and country everywhere a partner table shows up

_2026-07-28_

**Decided**:

1. **New `/poc/calls` tab** (nav: Console · Partner directory · Giving · Calls) lists partners worth a personal call, derived entirely from the already-loaded giving ledger (`buildCallCandidates` in `src/lib/poc/calls.ts`) — no extra Supabase query. Two criteria, combined with OR: **consistent** (`CONSISTENT_MIN_GIFTS = 2`+ distinct gifts) and **top giver** (top `DEFAULT_TOP_GIVERS = 20` by total amount, globally). Both are plain constants, not office-configured thresholds — easy to revisit once staff have used the page. Bank/interop statement rows (Decision 0008 §6) and gifts with no phone are excluded; there's no one to call. A giver who never registered as a partner still appears (their phone came from the payment itself) with branch/country reading as unassigned.
2. **The two criteria are checkboxes on a plain GET form**, both checked by default. A hidden `filtered` marker distinguishes a fresh page load (defaults apply) from a real submission with every box unchecked (an explicit empty result — turning off both criteria means no one qualifies, not "show everyone").
3. **`country` now renders on every partner-facing table**, not just `church` (branch): the directory table (data already flowed through `mapPartners`; only the missing `<th>`/`<td>` was added) and the giving ledger table (required plumbing `country` through `loadBranchByPhone` → `GivingEntry` first). The calls table shows it from the same source.

**Why**: staff asked for a way to prioritize follow-up calls without a new data pipeline, and to always see which country a partner is in, not just their branch — the region import (0012) made country the more useful grouping for most of the table now that `partners` spans 70+ countries.

**Said no to**: a configurable threshold UI for the two criteria (premature before anyone's used the page) · a new Supabase query for the calls list (the giving ledger already has everything needed) · call-outcome tracking / a dialer integration (that's the Phase 10 call queue, full MVP scope — this is a read-only priority list).

## 0014 — Giver categories and message-workspace ownership

_2026-08-01_

**Decided**: apply Bishop Ebo's requested giver categories and keep batch communication in the Messages workspace.

1. **Dashboard giver categories are mutually exclusive.** `Top` is the highest 20 people by total giving, matching the existing Calls rule (0013). After those people are removed, `Consistent` means two or more gifts; `Ordinary` is every other identifiable giver. Each Dashboard view shows up to 20 people, and no person appears in more than one category.
2. **Active BENMP partners means identifiable people who gave in the loaded period.** It is a people count, not a transaction count and not a lifetime-status claim. The Dashboard separately reports the number of gift transactions.
3. **Giving owns financial review; Messages owns batch communication.** Giving filters the ledger by date, name and inclusive minimum/maximum amount. Branch and country remain useful row context but branch is no longer the main filter. A row-level `Thank` action can still start one amount-aware acknowledgement. Preparing all acknowledgements or reminders happens only in Messages, with preview, explicit approval, opt-out enforcement and audit logging.
4. **Twenty editable special-message drafts are shared by individual and selected-partner sending.** The library contains four drafts each for ordinary, consistent, top, first-time and returning givers. `{name}` and `{amount}` are resolved from the available partner/giving data, and staff can edit the result before review and send.

**Why**: the office described top, consistent and ordinary givers as distinct working groups, asked for amount-led financial filtering, and asked for generic acknowledgements/reminders to move off the Dashboard. One message workspace prevents Giving and Messages from presenting competing versions of the same bulk-send workflow.

**Said no to**: a separate GHS threshold for the Dashboard's `Top` category (would conflict with the established top-20 Calls rule) · duplicate mass-thank controls on Giving and Messages · treating active people as gifts · hiding branch/country context merely because amount is now the primary filter.

## 0015 — Messages starts with the staff member's task

_2026-08-01_

**Decided**: the Messages workspace uses office language rather than implementation language. Its primary choices are **Thank people who gave**, **Send a reminder**, **Send a ministry update**, and **Message one person**. The old visible “Ready queues” concept is removed; reconciliation still prepares safe recipient groups underneath the guided workflow.

1. Partner communication follows three visible steps: choose people, write the message, then review and send. Staff can edit the wording before preview and must explicitly approve the final recipient count.
2. Acknowledgements automatically use each giver's recorded name and amount, exclude accepted acknowledgements, enforce opt-outs, and can optionally be narrowed by minimum and maximum gift amount.
3. Reminders use only the current reconciliation cohort: registered partners without a recognized gift in the loaded period. They are not inferred from the 26,000-person international directory.
4. Ministry updates retain deliberate partner search and selection. One-person messaging remains available for any valid international WhatsApp number.
5. The twenty special drafts live inside the message-writing step for deliberately selected partners and one-person messages, grouped by giver context. The thank-everyone workflow uses one clear editable acknowledgement so a category-specific draft cannot accidentally be broadcast to the wrong audience.

**Why**: the office should state what it wants to accomplish and let the system prepare the technical audience. Hiding queue terminology and progressively revealing filters makes the workflow usable for staff who are not technically inclined without weakening confirmation, opt-out, provider, and audit controls.

**Said no to**: three competing recipient modes in the main navigation · exposing reconciliation vocabulary to staff · showing every audience filter at once · moving financial review back into Messages.

## 0016 — Partner messages use cohorts, not individual picking

_2026-08-01_

**Decided**: staff never build a bulk audience by paging through the directory and ticking people one by one. The system resolves each audience from current partner and giving records when the preview is requested.

1. The screen names the exact **Giving window** from the earliest and latest successful payment records. Its three primary choices are **All partners**, **Gave in this window**, and **No gift in this window**. Staff never have to guess what “this period” means.
2. **Top 20 givers**, **Repeat givers**, and **Gift not linked to a profile** are available under one collapsed “More specific groups” control. Repeat means two or more gifts in the named window after the Top 20 are excluded; the last group means a gift exists but no registered partner record matches it. Gift-based groups can be narrowed with an optional inclusive minimum and maximum amount. “Ordinary giver” remains a Dashboard reporting category rather than a visible message label.
3. Every bulk task uses the same composer: editable wording, the shared twenty-draft library, an optional attachment, a personalized preview, and explicit approval of the final sendable count. One-person messaging uses the same attachment library and review behavior.
4. Audience membership is resolved again on the server at preview and send time. Client-supplied recipient lists are not trusted. Opt-outs, accepted thank-you deduplication, provider validation, allowlist rules, and audit logging remain in force.
5. A synchronous send is capped at 2,000 recipients. Larger global audiences can still be previewed, but staff must choose a smaller group until provider campaigns and background batching are implemented.

**Why**: manually selecting individuals does not scale to the 26,000-record directory and makes omissions likely. A few office-language cohorts are faster and clearer for non-technical staff, while one shared composer prevents the acknowledgement, reminder, and ministry-update paths from drifting into different tools.

**Supersedes**: Decision 0011's directory search-and-selection mode and Decision 0015 item 4's deliberate partner selection workflow. The four task entry points remain; only the way a bulk audience is chosen has changed.

**Said no to**: exposing every possible status as a filter · branch-first message targeting · using “ordinary giver” as a recipient-facing label · sending an unbounded global broadcast inside one web request · separate attachment controls for different message tasks.

## 0017 — Live sending requires a verified BENMP sender device

_2026-08-01_

**Decided**: provider credentials alone do not make WhatsApp “ready.” When WaliChat is selected, the server verifies that the configured BENMP device still exists in the connected account and is operative before the Messages page enables sending and again immediately before dispatch.

1. A missing, removed or disconnected sender blocks all sends with an office-language instruction to reconnect the BENMP number. Raw provider diagnostics and device identifiers are not shown to staff.
2. The recipient field continues to accept any valid international WhatsApp number. Sender-device readiness, opt-outs and an explicitly configured safety allowlist are separate controls; an empty allowlist means no recipient restriction.
3. Preview remains available while the sender is disconnected so staff can prepare and review work, but the API fails closed before attempting delivery.

**Why**: a stale Wali device ID previously looked configured until a real send failed with a low-level “device invalid” response. Readiness must describe the live provider state, not merely the presence of environment variables.

**Said no to**: silently falling back to mock delivery · removing the Wali device field · interpreting a disconnected sender as a recipient-number restriction · exposing provider internals as staff instructions.

## 0018 — Ghana hub admin platform: 31 hub logins, church-validated ingestion, fresh start

_2026-08-24_

**Decided**: build a hub-admin platform as the new front door for Ghana partner data. Bishop Ebo's structure: Ghana's churches are grouped into **31 hubs**, each with a leader who holds the list of BENMP partners in the churches of that hub. Each hub gets its own login and an Excel/CSV ingestion wizard that validates every row against that hub's approved church list before anything enters the database.

1. **Hubs are identified by number, always.** Hub numbers are the UIDs and the login usernames. Leader names (informally used in the office) are stored as display labels only. The canonical list — 31 hubs, 807 churches — is seeded from the office workbook (`scripts/data/ghana-hubs-churches.json`); a church is unique **within its hub**, and the same name may legitimately exist in several hubs (e.g. Akropong in hubs 11, 23, and 30).
2. **Church names**: Title Case for display, matching is case- and whitespace-insensitive, so capitalization never causes a validation failure. Alias handling (Qodesh vs Jesus Cathedral) is deferred; the editable preview's church dropdown is the v1 correction path. Trigger to un-defer: hub admins repeatedly correcting the same alternate name by hand.
3. **Hub login**: username = hub number; initial password = hub number; the system **forces a password change on first login**. Hub-admin sessions are distinct from the staff session. A hub admin sees only their own hub: the upload wizard, their hub's church list, and the partners they have ingested. The existing world-level staff role is unchanged.
4. **The wizard is a column picker, not a header template.** Upload `.xlsx`/`.csv` → choose the sheet → point at the name, WhatsApp-phone, and church columns. Header text is never a rejection reason; all strictness applies to cell values in the editable preview.
5. **Validation in the editable preview**, red mark per failing cell with the reason on hover: name must be at least two words; phone must normalize to a valid E.164 number (Ghana local `0XXXXXXXXX` accepted and converted to `+233…`; other country codes accepted); church must match the hub's approved list, corrected via dropdown; duplicate phone numbers are flagged — within the upload and against existing records ("already exists in Hub N") — never silently skipped or overwritten. Submission is blocked until every row is clean or removed.
6. **Every ingest is audit-trailed**: the batch (who, when, file, sheet, column mapping) and the raw rows as uploaded are retained alongside the accepted records, keeping intake greppable in the spirit of the CSV-import rule.
7. **Ghana fresh start, archive-first.** The hub platform becomes the only door for Ghana partner data. At cutover — after the platform is built and signed off, not before — the current data (partner/registration records, payments, message logs) is exported to CSV files handed to the office **and** copied to hidden archive tables in the same database, then cleared from the live system. The POC console keeps working untouched until that planned step.

**Why**: the hub structure is how the office actually works — 31 leaders each holding their own list — and pushing validation to the point of entry (with correction in an editable preview rather than a rejection letter) is the only way 31 non-technical admins produce clean data. Numbers as UIDs avoid the leader-name ambiguity the office itself flags as distracting.

**Said no to**: strict header templates (rejected files punish admins for cosmetic differences) · global uniqueness of church names (real churches share names across hubs) · alias tables in v1 · hub number as a permanent password (forced change on first login instead) · silent skipping or overwriting of bad/duplicate rows · outright deletion of the old data (archive + clear, recoverable in minutes) · clearing before the replacement is ready.

## 0019 — The old Ghana list comes back as a broadcast audience, not as partners

_2026-08-30_

**Decided**: the office wants one WhatsApp broadcast to the pre-cutover Ghana contacts. Those contacts return to the product as a **separate table with a single reader**, never as partner records.

1. `public.legacy_ghana_contacts` (migration 0007) is populated once from `archive.partners_pre_hub` — Ghana rows with a non-empty `whatsapp_number`, deduped to one row per number. ~13.1k archived Ghana rows collapse to ~11.6k reachable numbers.
2. Its only reader is a new `legacy-ghana` audience in the message composer, labelled "Old Ghana list (archived)". Directory search, giving, reconciliation, branch grouping, partner counts and every hub surface are untouched — they read `partners`, which since the cutover holds only hub-ingested people.
3. **Nothing merges the two.** No join, no backfill into `partners`, no `hub_id`. The hub platform remains the only door for live partner data (Decision 0018 item 7).
4. Consent is shared rather than duplicated: the send path checks `public.opt_outs` by phone, so a STOP from this broadcast also protects that number if it later arrives through a hub upload. `loadOptOuts` was changed from a `limit=5000` read to a paged one — a cap would have silently dropped opt-outs and messaged people who had asked not to be.
5. `last_sent_at` on each row exists so a batched or retried run cannot double-send.
6. Sending is **not** unblocked by this change. The BENMP WhatsApp number is disconnected (Decision 0017 fails closed) and the 2,000-recipient synchronous cap still applies, so ~11.6k needs batching. Preview works today; dispatch waits for the number to be reconnected.

**Why**: the office's need is one campaign to an old list, not a restored partner database. Keeping the contacts in their own table makes the separation structural rather than a matter of care — there is no query that can accidentally blend them, and no partner count that silently grows by 11.6k. Reusing the existing audience plumbing means opt-outs, preview, explicit confirmation and audit logging apply to this broadcast exactly as they do to every other one.

**Supersedes**: Decision 0015 item 3's blanket exclusion of the old directory from bulk sends, for this audience only. Reminders and acknowledgements still never infer recipients from it.

**Said no to**: restoring the archive into `partners` (would mix with hub uploads and inflate every partner-facing count) · a separate Supabase project (fragments the opt-out list, so a STOP in one place would not protect the number in the other) · exposing the `archive` schema through PostgREST · raising the 2,000 cap to force one oversized synchronous send · giving the legacy audience amount filters or `{amount}` drafts it has no data for.
