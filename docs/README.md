# Start here

> The 5-minute front door. Read this fully, then open the docs below based on the work you are doing.

## What we're building

A staff-only console + AI assistant for the BENMP office (~40,000 partners worldwide). Partners never log in - they give through 2-3 published channels and are met on WhatsApp/SMS/email/phone. A gift becomes a relationship automatically: identified -> thanked in minutes -> classified -> follow-up queued. Month-end answers itself: who paid, who didn't, per region.

## The system in 60 seconds

- **Pipeline**: gift -> `payment_event` (immutable) -> verify -> match by phone -> contribution -> thank-you -> high-touch flag if big. Two intake doors: provider webhooks (instant) and statement imports (daily).
- **Channels** (custody-first, Decision 0006): Ghana = MTN MoMoPay merchant account (*170# pay); Europe/UK/Australia-Asia = BENMP bank accounts + reference words; North America = text-to-give; Rest of Africa/S. America = remittance apps to the Ghana wallet. **Statement imports are the backbone; webhooks upgrade where free. No SMS parsing, ever.**
- **Monthly cycle**: reminders -> gifts -> acknowledgements -> close on the 1st (frozen per-region snapshot). Reminders ARE the recurring mechanism (recurring MoMo mandates don't exist).
- **Rules**: $5/mo baseline, $60/yr USD-equivalent = active, $100+ or above-usual = high-touch priority call. Thresholds are admin-config, not code.
- **Regions**: Ghana, Rest of Africa, Europe, UK, Australia/Asia, South America, North America (configurable lookup, clarified 2026-07-09).
- **AI**: agentic in stages: answers (week 1) -> drafts -> acts -> runs workflows. Send/mutate always behind human approval tokens.
- **Architecture**: Next.js 16 + Supabase Postgres; every provider (payments, messaging, AI model, database) behind a swappable adapter.

## Doc map

| Doc                                                    | Answers                                                                    | Time                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------- |
| **This file**                                          | The gist, current status, what's open                                      | 5 min                             |
| [srs.md](srs.md)                                       | What the system must do: personas, requirements, business rules, non-goals | 15 min                            |
| [db-schema.md](db-schema.md)                           | Human-readable schema contract; migrations remain implementation truth     | 15 min                            |
| [delivery-plan.md](delivery-plan.md)                   | Who builds what, in what order, this week                                  | 10 min (your track only)          |
| [design-spec.md](design-spec.md)                       | Every design detail + the UI redesign proposal (Appendix A)                | Reference - use the section map   |
| [decisions.md](decisions.md)                           | Why we chose X - five entries, TL;DR first                                 | Skim before relitigating anything |
| [security.md](security.md)                             | Auth, RLS, payment/webhook safety, consent, AI approval, audit             | Before backend/provider work      |
| [deployment.md](deployment.md)                         | Vercel/Supabase setup, env vars, migrations, backups, release checklist    | Before going live                 |
| [api-spec.md](api-spec.md)                             | Planned API/server-action/webhook contract                                 | Before backend routes             |
| [ops-runbook.md](ops-runbook.md)                       | How the BENMP office should use the system day to day                      | Before training staff             |
| [benmp-prm-client-brief.md](benmp-prm-client-brief.md) | Plain-language PDF source for BENMP/HJC leadership and office discussion   | Share externally                  |

Older deep-context docs (product brief, architecture, research, board brief, AI roadmap) live in [archive/](archive/) - history, not required reading.

## Status (2026-07-08)

**Done**: mock MVP (all pages, adapter-first, zero credentials), consolidated design + five decisions, executable delivery plan with parallel tracks, UI audit (design-spec Appendix A, awaiting team review), requirements/schema/security/deployment/API/ops docs.
**Now**: the **one-week MVP sprint**. Day 0 is provider signups (calendar time), then four parallel tracks. See the sprint section of [delivery-plan.md](delivery-plan.md).
**Demo at week's end**: real login -> real partners -> test MoMo + Stripe gifts appearing matched with thank-you drafts in under a minute -> statement import + reconciliation -> AI answering the board's five headline questions.

## Open items

- **Team to decide**: the 5 UI questions at the end of design-spec Appendix A.
- **Leadership to decide**: council flows — central, federated, or hybrid (Decision 0006 recommends hybrid).
- **Office to provide**: **submit the MTN MoMoPay merchant application (new longest pole)**, partner Excel export, statement access for each wallet/bank account, business registration docs, per-region bank account details, remittance share of current giving, **take down the public prototype page exposing partner PII**.

## Conventions

- **Nothing gets built without a trigger.** Every deferred feature names the condition that un-defers it (e.g. claim loop <- "office reports remittance share is significant"; sequence engine <- "manual batches become the bottleneck"; pawaPay <- "rest-of-Africa in-country volume justifies it"). If a feature has no trigger, it doesn't get scheduled.
- Committed docs = engineering truth; sensitive client specifics (account numbers, statements, partner data, office internals) stay out of git.
- Migrations are the schema law. Contributions only from verified payment_events. Money = original currency + USD equivalent, never JS floats. Provider code stays inside adapters. Every send checks consent; bulk sends need a named approver. Full list: "Cross-phase rules" in [delivery-plan.md](delivery-plan.md).
