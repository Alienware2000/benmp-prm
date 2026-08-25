# Handoff — where the BENMP PRM stands

_Last updated 2026-08-14._

The "where are we right now" snapshot. Read alongside [`docs/README.md`](README.md) (project front door) and [`docs/decisions.md`](decisions.md) (numbered decisions, 0001–0017).

> **No secrets in this file.** Every credential lives in `.env.local` (gitignored) and in the Vercel project environment. Variable *names* are listed in [`.env.example`](../.env.example); values are never committed. This repository is public.

## What is live

- **Production**: the POC console at `/poc`, password-gated via an in-app login at `/login` (shared password, username-free). Deployed on the **BENMP-owned Vercel account** — never a personal or Beakr account.
- **Auto-deploy**: GitHub `main` → Vercel production, connected and verified. Merging a PR ships it.
- **Data**: real Qodesh data in Supabase (roughly 900 registrations and 200 payments). Loaded by `scripts/load-poc-data.ts` from local CSV files that are deliberately kept outside git.
- **AI**: a grounded assistant over the real data. It refused invented figures under adversarial testing. There is a deterministic fallback when no model key is configured.
- **Gate**: `npm run typecheck && npm run lint && npm test && npm run build`.

## POC scope (Decision 0008)

Ghana and MoMo only, Qodesh campus. No GDPR or registration flow in the POC.

The load-bearing rule: **payers who are not on the register are included and messaged like everyone else.** Implemented in `src/lib/reconcile.ts` and surfaced in the UI as "gave, not registered — included and thanked anyway." Reminders are event-driven; there is no cron. Same-day acknowledgement is acceptable, instant is a nice-to-have, and receiving the money is the priority.

## WhatsApp sending — current state

The provider story moved twice since the first draft of this document, so read the decisions rather than assuming:

- **WaliChat is the current pilot provider** (Decision 0010, 2026-07-24), selected with `BENMP_MESSAGING_PROVIDER=wali` and driving a BENMP-owned WhatsApp Business number. Meta Cloud API remains the long-term direct path; the adapter boundary is deliberate so the provider stays swappable.
- Earlier providers are still present as adapters and are **not** the active path: Twilio (blocked by trial template policy on both SMS and WhatsApp), Vonage sandbox, WhatChimp, Meta Cloud, plus `mock`.
- **Sender-device readiness is enforced** (Decision 0017, 2026-08-01). Credentials alone do not mean ready: the server checks that the configured BENMP device still exists and is operative both before the Messages page enables sending and again immediately before dispatch. A missing or disconnected sender fails closed with office-language instructions rather than provider internals. `npm run wali:check` verifies the sender without sending anything.

**Safety controls on every send**, all still in force: preview is the default and a real send needs explicit confirmation; opt-outs are honoured; `BENMP_SEND_ALLOWLIST` restricts recipients when set (empty means no restriction); every attempt, including skipped and failed, is written to `sent_messages`.

⚠️ A local environment configured with a real provider can send to real people. Never confirm-send locally against production data.

## Reconciliation and message quality

- **Statement-noise filter**: `reconcile()` returns a `statementRows` bucket for unmatched payments whose payer name matches a curated bank/interop pattern list (`isStatementRow` in `src/lib/reconcile.ts`). On real data this was about 30 rows and roughly 31% of the total value. The money stays in Collected, but people counts, tables and the message plan exclude them, and the console says how many were filtered. A phone match beats the name check.
- **Known follow-up, not built**: an unregistered person with N payments receives N thank-yous, because `paidUnregistered` is per-payment rather than per-phone. Roughly 20 people are affected. Aggregate by phone before any large real send.

## Shipped since the POC console

- **Partner directory and workspace**: region import for Africa, international and Italy directories; a calls tab; country shown wherever a partner table appears (Decisions 0012, 0013).
- **Messaging workspace**: unified into one workspace that starts from the staff member's task, addresses **cohorts rather than individually picked people**, and reuses shared messaging workflows (Decisions 0011, 0014, 0015, 0016).
- **Monthly mixed call shortlist** with per-bucket quotas, surfaced in a messages tile.
- **Giving cohorts clarified**, amount-aware messaging, a safe mass thank-you workflow, and improved acknowledgement error recovery.
- **Media gift acknowledgements**, with the provider attachment limit enforced.
- **Staff sign-in refresh**, and light mode enforced on every device.

## Ghana hub admin platform — LIVE (Decision 0018, deployed 2026-08-25)

The hub platform is deployed and seeded in production: 31 hubs, 807 churches, 31 hub accounts (verified counts in Supabase). Hub leaders sign in at `/login` (Hub leader tab) with their hub number; the starting password is the hub number and a change is forced on first sign-in. Smoke-tested on production: hub 7 login → forced password screen → signed out without setting a password, so every hub's starting credential remains the hub number. Ghana archive-and-clear cutover (HP-4) has NOT happened — the POC console and its data are untouched.

Still open before rollout: an admin path to reset a hub's password (currently a manual SQL update) · office confirmation of the church list · HP-4 (hub partner view + archive & cutover).

## Background — original plan: Ghana hub admin platform (Decision 0018)

Agreed 2026-08-24 from Bishop Ebo's hub structure: 31 Ghana hubs, each with its own login (hub number; forced password change on first use) and a church-validated Excel/CSV ingestion wizard with an editable correction preview. Ghana data gets a fresh start — the current data is archived (CSV export + hidden archive tables) and cleared **only at cutover, after the platform is built and signed off**; the POC console runs untouched until then. Canonical hub/church seed: `scripts/data/ghana-hubs-churches.json`. Plan: the "Hub Admin Platform" phases (HP-1…HP-4) in [phases.md](phases.md); schema in [db-schema.md](db-schema.md).

## Picking this back up

1. Read `docs/decisions.md` from 0010 onward — that is where the current shape of the system was set.
2. Confirm the live sender with `npm run wali:check` before trusting anything about sending.
3. Check for collaborator branches and open PRs before building; this repo has had more than one author.
4. Run the full gate before pushing.

## Team and process notes

- Work is coordinated with a collaborator who built several of the ingest, messaging-plan, send-loop, AI and console PRs. Check for their open work first.
- Docs stay lean: consolidate into existing files rather than spawning new ones.
- UI work is screenshot-verified in a real browser before shipping.
- Design language for `/poc`: green success accent on the app's token system, icon tiles with tinted rings, three-zone cards, tabular numerals, preview-before-send everywhere, and a count in the send button.
- The Playwright smoke test asserts the older home page and may need updating if `/` changes.
- `docs/phases.md` holds the post-POC MVP plan (CSV-first payments, pre-filled payment links with subscriptions as the target, region blocks). It resumes once the POC proves out.

## Environment

Names only; values live in `.env.local` and the Vercel project.

- Supabase connection variables, an AI model key, the POC login variables, `BENMP_MESSAGING_PROVIDER`, `BENMP_SEND_ALLOWLIST`, and the credential set for whichever messaging provider is selected. See [`.env.example`](../.env.example) for the full list.
- Data loader: `npx tsx --env-file=.env.local scripts/load-poc-data.ts`, expecting the registration and MoMo CSVs in a local directory kept outside git.
