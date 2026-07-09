# Tech Stack

Last updated: 2026-07-09. Companion to `docs/decisions.md` (the *why*) and `docs/db-schema.md` (the data contract).

> Every choice here traces to a need in `docs/delivery-plan.md` and a decision in `docs/decisions.md` — the stack is derived from the phases, not chosen up front. Where a row diverges from what is currently installed, it is flagged **PLANNED** with the phase that lands it. `Installed` versions are read from `package.json`; treat `package.json` as the source of truth for exact versions.

## At a glance

| Layer | Choice | Status | Traces to |
| --- | --- | --- | --- |
| Framework | Next.js (App Router), full-stack | Installed | Transcript: Python/FastAPI rejected, "Next.js is both front-end and back-end" |
| Language | TypeScript | Installed | Transcript: "It should be TypeScript to be specific" |
| Hosting | Vercel | Deploy target | Transcript: deploy "on Vercel"; `docs/deployment.md` |
| Database | Supabase Postgres (+ RLS) | Installed (client) | Decision 0004; Transcript: "I agree with Postgres", RLS valued |
| Data access | **`@supabase/supabase-js` + `@supabase/ssr`** (no ORM) | Installed | Decision 0006: RLS works as the authz gate; types via `supabase gen types` |
| Auth | Supabase Auth (email/password + email-verify invite) | Installed | Decision 0004; Transcript: email-invite staff onboarding |
| Payment intake | **CSV import** (parse → match → tick paid); no payment provider | PLANNED (Phase 6) | Decision 0007: no live payments; money reconciled from a periodic CSV |
| Recurring giving | `recurring_commitments` pledge records + reminders (no charging) | PLANNED (Phase 9) | Decision 0007: pledges flag "who hasn't paid"; the reminder loop is the mechanism |
| Messaging | Twilio (WhatsApp + SMS) + Resend (email) | PLANNED (Phase 7) | Decision 0004 |
| AI runtime | Vercel AI SDK (`ai`), provider behind model registry | Installed | Decision 0001/0002 |
| AI model | **Anthropic Claude via GCP Vertex AI** | **PLANNED (Phase 8)** | Transcript: "Vertex already has Claude", Anthropic key |
| Testing | **Vitest** (unit/integration) + **Playwright** (E2E) | Installed | TDD model: every task ships an executable green-test gate |
| Validation | Zod | Installed | Standard across server actions / tool schemas |
| CSV import | papaparse | Installed | Import-tool emphasis; Phase 4/7 |
| Phone normalization | `src/lib/phone.ts` (E.164, Ghana-aware) | PLANNED (Phase 4) | Repeated theme: match partners by normalized phone |

## Core framework

| Package | Installed | Purpose |
| --- | --- | --- |
| `next` | 16.2.10 | App Router, route handlers (the REST API), Turbopack. **Not the Next.js in training data** — read `node_modules/next/dist/docs/` (proxy.ts, not middleware.ts). |
| `react` / `react-dom` | 19.2.4 | UI |
| `typescript` | ^5 | Types |
| `eslint` / `eslint-config-next` | ^9 / 16.2.10 | Lint (`npm run lint`, not bare `npx eslint`) |
| `tailwindcss` | ^4 | Utility CSS |

**Decision**: one Next.js app is both front-end and back-end. There is **no separate Python/FastAPI service** — the transcript raised it and rejected it. "REST API" means Next route handlers under `src/app/api/**` plus server actions. Deploy to **Vercel**.

## Data layer — Supabase directly (no ORM)

**Decision 0006**: data access is the **Supabase client** (`@supabase/supabase-js` + `@supabase/ssr`), already installed. No Prisma, no Drizzle, no ORM.

- **Schema**: hand-written SQL under `supabase/migrations/` (authoritative; `docs/db-schema.md` is the human-readable contract). Migrations enable RLS on every table in the same file that creates it.
- **Types**: `supabase gen types typescript` generates DB types from the live schema — type safety without an ORM.
- **Money invariant**: original amounts are **integer minor units** (`amount_minor`) + currency; `usd_equivalent` is `numeric` (the client returns numerics as **strings**, so no JS float — parse with a decimal helper only when arithmetic is needed).
- **`PrmRepository` stays the seam.** The Supabase queries live *inside* `src/lib/data/` behind the existing repository contract — UI and business logic import the contract only (Decision 0002). The mock provider is unaffected.

**RLS is the authorization gate.** The Supabase client runs queries under the logged-in user's JWT, so per-role RLS policies (from `db-schema.md`/`security.md`) enforce reads/writes directly — a viewer's write fails at the database. Server actions still validate input and shape, but RLS is the primary gate, not a bypassed backstop. Region scoping (Phase 10) is RLS-enforced too. (Service-role key is used only in trusted server code that deliberately needs to bypass RLS, e.g. CSV import commit and seeds.)

## Auth

**Supabase Auth**, email/password. Staff onboarding is an **email-invite → verify-link** flow (transcript: "send a link to the email to verify… then they're verified"). `profiles` rows carry `staff_role`; `src/proxy.ts` protects all app routes except login and `/api/webhooks/*`. Supabase owns the `auth` schema; `public.profiles.id` references `auth.users(id)`.

## Payments

| Rail | Provider | Modes | Notes |
| --- | --- | --- | --- |
| All regions | **CSV payment import** | Periodic upload, matched to partners | The office already exports a statement/CSV of where money landed; no provider integration (Decision 0007) |

- **No payment provider, no webhooks, no charges.** Money enters only through a CSV upload parsed in `src/lib/payments/csv/` and matched by `src/lib/payments/match.ts`. Contributions come only from verified `payment_events` (source `csv_import` or `manual`).
- **Recurring** = the monthly reminder loop, never an auto-debit. `recurring_commitments` are pledge records (expected amount) used to flag who has not appeared in a period's CSV; the CSV match clears the pledge. No cron issues charges (Decision 0007).
- No payment-provider SDKs are needed (`paystack`/`stripe` removed). CSV parsing uses `papaparse`; phone matching uses `src/lib/phone.ts`.

## Messaging

**Twilio** (WhatsApp + SMS) + **Resend** (email), behind `MessagingAdapter` (`BENMP_MESSAGING_PROVIDER`). Meta Cloud API is the long-term direct WhatsApp path (Decision 0004) evaluated in Phase 10. All PLANNED (Phase 7). Every send passes a consent check; bulk sends need a recorded approver.

## AI

- **Runtime**: Vercel AI SDK (`ai` ^7.0.16, installed), model resolved via `src/lib/ai/model-registry.ts` — no provider names in business logic (Decision 0002).
- **Model**: **Anthropic Claude on GCP Vertex AI**. Provider package `@ai-sdk/google-vertex` (Anthropic-on-Vertex entrypoint) — **PLANNED**. Requires: a GCP project, **Vertex AI API enabled**, Claude enabled in Vertex Model Garden, a service-account credential, and a Claude-supported Vertex region (e.g. `us-east5`). Keeping it behind the registry means a later swap to the direct Anthropic API is a config change, not a rewrite.
- v1 is **read-only** (Decision 0001): analyst tools over `PrmRepository`, no mutation/send tools. Runs logged to `ai_runs`.

## Utility & shared libs

| Package | Installed | Purpose |
| --- | --- | --- |
| `zod` | ^4.4.3 | Input validation, AI tool schemas |
| `papaparse` | ^5.5.4 | CSV import (partners, statements) |
| `date-fns` | ^4.4.0 | Dates |
| `@tanstack/react-table` | ^8.21.3 | Admin tables |
| `recharts` | ^3.9.2 | Reports charts |
| `tailwindcss` / `clsx` / `tailwind-merge` / `lucide-react` | 4 / 2 / 3 / 1 | UI |
| `src/lib/phone.ts` | PLANNED | E.164 canonicalization (Ghana-aware); the **only** place phones are normalized/compared |

## Testing — the TDD green gate

The build is test-driven: **every task completes only when its test passes.** Two runners:

| Runner | Installed | Scope | Command |
| --- | --- | --- | --- |
| **Vitest** | `vitest` (dev) | Unit + integration — pure logic (phone E.164, status rules, matching, FX), repository behavior against the mock/Supabase layer, server-action logic | `npm test` (CI) · `npm run test:watch` |
| **Playwright** | `@playwright/test` (dev) | E2E acceptance flows that exercise the running app (login, import, gift → contribution → ack, reconciliation queue, AI answers) | `npm run test:e2e` |

- Config: `vitest.config.ts` (node env, `@/*` alias, collects `src/**/*.{test,spec}.ts`), `playwright.config.ts` (specs in `e2e/`, auto-starts `npm run dev`).
- **Per-task convention**: a unit/integration task ships `*.test.ts` next to its code; a phase/epic acceptance task ships an `e2e/*.spec.ts`. A task is "done" only when its named test is green — see `docs/phases.md`.
- **CI gate at every phase boundary**: `npm run typecheck && npm run lint && npm test && npm run build` (add `npm run test:e2e` on the flows a phase claims to deliver).

## Runtime & platform

- **Node**: per Vercel's Next 16 runtime.
- **Hosting**: Vercel (app + cron). **Database/Auth/Storage**: Supabase.
- **Cloud (AI)**: GCP (Vertex AI) — the one non-Vercel/Supabase dependency, introduced only at Phase 8.
- **CI**: typecheck + lint + build green at every phase boundary (`npm run typecheck && npm run lint && npm run build`).

## Env vars (stack-driven)

```
# Data (Supabase)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only (CSV import commit, seeds)

# Providers (behind adapters) — no payment provider (Decision 0007)
BENMP_DATA_PROVIDER=mock|supabase
BENMP_MESSAGING_PROVIDER=mock|twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
RESEND_API_KEY=

# AI (Claude on Vertex)
GOOGLE_VERTEX_PROJECT=
GOOGLE_VERTEX_LOCATION=us-east5
GOOGLE_APPLICATION_CREDENTIALS=   # or inline service-account JSON var
```

## Migration note — what this stack adds vs. what's shipped

The **data layer matches the shipped repo** (`@supabase/ssr` + `@supabase/supabase-js`, SQL migrations, RLS) — no change there. What's not yet installed:

1. **Claude via Vertex** — no AI provider package installed yet; Phase 8 adds `@ai-sdk/google-vertex` behind the model registry.
2. **Messaging SDKs** — Twilio + Resend land in Phase 7. **No payment SDKs** — intake is CSV parsing (`papaparse`), not a provider (Decision 0007).

Everything else (Supabase + RLS, CSV import, Twilio + Resend, Vercel, Next.js/TS, Vitest/Playwright) matches Decisions 0006/0007 and the transcript with no divergence.
