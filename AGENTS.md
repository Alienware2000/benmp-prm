<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BENMP PRM Agent Guide

## Project

BENMP PRM is an internal Partner Relationship Management system for BENMP and the Healing Jesus Campaign. It is staff-facing: the ministry team uses it to manage partners, giving, prayer requests, campaigns, communication, and follow-up across WhatsApp, SMS, email, and phone workflows.

## Working Principles

- Treat `docs/` as the portable source of truth. Read order: `docs/README.md` (front door + status) -> `docs/srs.md` (requirements) -> `docs/tech-stack.md` (the decided stack + versions) -> `docs/db-schema.md` (data contract) -> `docs/phases.md` (**what to build**: the authoritative 14-phase test-driven plan; supersedes `delivery-plan.md`'s phase list) -> `docs/design-spec.md` (deep reference - use the section map at its top) -> `docs/decisions.md` (why). `docs/delivery-plan.md` is a companion (Workstreams, one-week sprint, Cross-phase rules) whose phase list is superseded by `phases.md`. Use `docs/security.md`, `docs/deployment.md`, `docs/api-spec.md` (+ `docs/openapi.yml`, the machine-readable subset), `docs/user-journeys.md` (per-persona flows), and `docs/ops-runbook.md` when touching those areas. `docs/archive/` is history, not required reading.
- Not everything belongs in git: engineering docs yes; sensitive client specifics (real account numbers, statements, partner exports, office internals) no — reference them, don't embed them.
- Nothing gets built without a trigger: deferred features name the condition that un-defers them (conventions in `docs/README.md`).
- This repo (`Alienware2000/benmp-prm`) is the codebase going forward; the frontend consolidation (design-spec Appendix A) is a pass on it, not a rewrite.
- Prefer small, verifiable changes. Update docs when product architecture or workflow decisions change.
- Keep public donor experiences separate from this internal staff workspace unless a task explicitly bridges them.
- Build the PRM foundation first: partners, giving, campaigns, communication history, follow-up tasks, imports/exports, roles, audit logs.
- Keep AI provider-agnostic. Use the AI SDK layer for model calls when AI is introduced, and isolate provider selection behind configuration.
- Never store payment card data, WhatsApp tokens, API keys, or private partner information in git.
- Docs update in the same change, never as a follow-up: schema change → `docs/db-schema.md`; new/changed route or server action → `docs/api-spec.md`; plan deviation → "As-built notes" in `docs/phases.md`; workflow/architecture decision → `docs/decisions.md`. Keep docs concise and scannable.
- Verify with `npm run lint` (the npm script, not a bare `npx eslint` — config resolution differs) plus `npm run typecheck` before calling a change done.
- CSV import/intake code paths emit structured logs (source, row reference, match outcome, status) — money movements must be greppable. (No payment provider/webhooks — Decision 0007.)

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run format:check
```

## Product Language

- Product name in code/repo: `BENMP PRM`
- Product name in UI: `Global Crusade Partners Platform`
- Primary users: BENMP administrators, finance staff, communication staff, regional coordinators, prayer team, viewers/auditors.

## Implementation Notes

- Next.js App Router lives under `src/app`.
- Mock/demo data lives behind the `PrmRepository` contract in `src/lib/data/`.
- Data layer is **Supabase directly** (Decision 0006 — no ORM): `@supabase/supabase-js` + `@supabase/ssr` behind `PrmRepository`, SQL migrations under `supabase/migrations/` (authoritative), types via `supabase gen types`. RLS is the authorization gate. `docs/db-schema.md` is the human-readable contract.
- AI architecture lives in `docs/design-spec.md` §8 and `src/lib/ai`.
