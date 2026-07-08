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
2. Reporting groups by **five region blocks** — Ghana, Rest of Africa, Europe, UK, America — as a configurable lookup (pending office confirmation). One block per partner, derived from country, overridable.
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
- **Merchant-tier registration is non-negotiable at scale**: 40k × $5/month breaches consumer wallet caps, and ministry money should settle to BENMP's bank with an audit trail, not sit on one person's phone.

**Said no to**: bare wallet number as the main channel (blind + fragile) · SMS parsing (rejected as ledger forever) · one provider for everything (none covers Ghana USSD + pan-Africa MoMo + diaspora cards).

**Deferred with triggers**:
- **WhatsApp claim loop** (partner messages "I gave" → instant provisional thank-you → claim auto-matches the statement) — build only if the office reports remittance-app giving is a significant share.
- **pawaPay** — add only if rest-of-Africa in-country volume justifies upgrading those partners from the wallet channel to a true merchant rail.
