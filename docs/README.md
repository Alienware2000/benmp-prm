# Start here

> The 5-minute front door. Read this fully, then open the docs below based on the work you are doing.

## What we're building

A staff-only console + AI assistant for the BENMP office (~40,000 partners worldwide). Partners never log in - they give through 2-3 published channels and are met on WhatsApp/SMS/email/phone. A gift becomes a relationship automatically: identified -> thanked in minutes -> classified -> follow-up queued. Month-end answers itself: who paid, who didn't, per region.

## The system in 60 seconds

- **Pipeline**: gift -> `payment_event` (immutable) -> verify -> match by phone -> contribution -> thank-you -> high-touch flag if big. Two intake doors: provider webhooks (instant) and statement imports (daily).
- **Channels** (merchant-first): Ghana USSD short code (webhook), Stripe giving link (webhook), wallet number for remittance apps, statement-confirmed. **No SMS parsing, ever.**
- **Monthly cycle**: reminders -> gifts -> acknowledgements -> close on the 1st (frozen per-region snapshot). Reminders ARE the recurring mechanism (recurring MoMo mandates don't exist).
- **Rules**: $5/mo baseline, $60/yr USD-equivalent = active, $100+ or above-usual = high-touch priority call. Thresholds are admin-config, not code.
- **Regions**: Ghana, Rest of Africa, Europe, UK, America, South America, Australia/Asia (configurable lookup, pending office confirmation).
- **AI**: agentic in stages: answers (week 1) -> drafts -> acts -> runs workflows. Send/mutate always behind human approval tokens.
- **Architecture**: Next.js 16 full-stack (TypeScript) on Vercel + Supabase Postgres (accessed directly via `@supabase/supabase-js`, **no ORM**; RLS is the authz gate); AI is **Claude on GCP Vertex** behind the AI SDK registry; every provider (payments, messaging, AI model, database) behind a swappable adapter. Full stack + versions in [tech-stack.md](tech-stack.md).

## Doc map

| Doc                                                    | Answers                                                                    | Time                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------- |
| **This file**                                          | The gist, current status, what's open                                      | 5 min                             |
| [srs.md](srs.md)                                       | What the system must do: personas, requirements, business rules, non-goals | 15 min                            |
| [tech-stack.md](tech-stack.md)                         | The decided stack + versions (Next/Supabase/Paystack/Stripe/Twilio/Vertex) | 10 min                            |
| [db-schema.md](db-schema.md)                           | Human-readable schema contract; SQL migrations are the implementation truth | 15 min                            |
| [phases.md](phases.md)                                 | **What to build**: the authoritative 14-phase test-driven plan             | 15 min                            |
| [delivery-plan.md](delivery-plan.md)                   | Companion: Workstreams, one-week sprint, Cross-phase rules (phase list superseded by phases.md) | 10 min (your track only) |
| [design-spec.md](design-spec.md)                       | Every design detail + the UI redesign proposal (Appendix A)                | Reference - use the section map   |
| [decisions.md](decisions.md)                           | Why we chose X - five entries, TL;DR first                                 | Skim before relitigating anything |
| [security.md](security.md)                             | Auth, RLS, payment/webhook safety, consent, AI approval, audit             | Before backend/provider work      |
| [deployment.md](deployment.md)                         | Vercel/Supabase setup, env vars, migrations, backups, release checklist    | Before going live                 |
| [api-spec.md](api-spec.md)                             | Planned API/server-action/webhook contract                                 | Before backend routes             |
| [openapi.yml](openapi.yml)                             | Machine-readable companion to api-spec (a representative subset)            | Before backend routes             |
| [user-journeys.md](user-journeys.md)                   | Per-persona flows: trigger → screens → server → DB state                   | Before building a workflow         |
| [ops-runbook.md](ops-runbook.md)                       | How the BENMP office should use the system day to day                      | Before training staff             |
| [benmp-prm-client-brief.md](benmp-prm-client-brief.md) | Plain-language PDF source for BENMP/HJC leadership and office discussion   | Share externally                  |

Older deep-context docs (product brief, architecture, research, board brief, AI roadmap) live in [archive/](archive/) - history, not required reading.

## Status (2026-07-08)

**Done**: mock MVP (all pages, adapter-first, zero credentials), consolidated design + five decisions, executable delivery plan with parallel tracks, UI audit (design-spec Appendix A, awaiting team review), requirements/schema/security/deployment/API/ops docs.
**Now**: the **one-week MVP sprint**. Day 0 is provider signups (calendar time), then four parallel tracks. See the sprint section of [delivery-plan.md](delivery-plan.md).
**Demo at week's end**: real login -> real partners -> test MoMo + Stripe gifts appearing matched with thank-you drafts in under a minute -> statement import + reconciliation -> AI answering the board's five headline questions.

## Open items

- **Team to decide**: the 5 UI questions at the end of design-spec Appendix A.
- **Office to provide**: partner Excel export, whether the MoMo number is personal or merchant-tier + statement access, business docs for Paystack/Hubtel, Stripe settlement entity, region-block confirmation, remittance share of current giving, **take down the public prototype page exposing partner PII**.

## Conventions

- **Nothing gets built without a trigger.** Every deferred feature names the condition that un-defers it (e.g. claim loop <- "office reports remittance share is significant"; sequence engine <- "manual batches become the bottleneck"; pawaPay <- "rest-of-Africa in-country volume justifies it"). If a feature has no trigger, it doesn't get scheduled.
- Committed docs = engineering truth; sensitive client specifics (account numbers, statements, partner data, office internals) stay out of git.
- SQL migrations are the schema law (Decision 0006, just-Supabase; `db-schema.md` is the contract). Contributions only from verified payment_events. Money = original minor units + USD-equivalent numeric, never JS floats. Provider code stays inside adapters. Every send checks consent; bulk sends need a named approver. **A task is done only when its test is green** ([phases.md](phases.md) "Definition of done"). Full list: "Cross-phase rules" in [delivery-plan.md](delivery-plan.md).
