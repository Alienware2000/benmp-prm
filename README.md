# BENMP PRM

Internal Partner Relationship Management for BENMP and the Healing Jesus Campaign.

The app is a staff-only workspace for partner profiles, giving records, campaign support, prayer requests, communication, and follow-up. The public BENMP registration and donation flow can remain separate; this system is the operating console behind the work.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Adapter-first data layer, starting with typed mock repositories
- Supabase, Neon/Postgres, or AWS Aurora/Postgres can be added later
- AI SDK 7 planned as the model-agnostic AI layer

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run format:check
```

## Workspace Map

- `WORKSPACE.md` - front door for any coding agent
- `AGENTS.md` - canonical project instructions for Codex, Claude Code, Cursor, and other agents
- `CLAUDE.md` - imports `AGENTS.md`
- `docs/product-brief.md` - product definition and MVP scope
- `docs/research.md` - research notes and sources
- `docs/architecture.md` - system architecture
- `docs/ai-native-roadmap.md` - agentic roadmap after the core PRM is stable
- `docs/handoff.md` - current status and next actions
- `src/lib/data` - data repository adapters
- `src/lib/messaging` - WhatsApp/SMS/email provider adapters
- `supabase/migrations` - optional Postgres/Supabase schema drafts

## Current State

The app is repository-driven across the core PRM modules. The current adapter is a typed mock seed repository, but every page now reads through the same `PrmRepository` contract that a Supabase/Postgres backend should implement.

Current working surfaces:

- Operational overview with staff queue, giving momentum, country summaries, campaign readiness, and backend readiness.
- Partner directory with URL-backed search/filtering and mobile-friendly record cards.
- Giving ledger with payment import batches, provider references, reconciliation status, and follow-up triggers.
- Messaging center with segments, approval batches, compliance checks, and provider adapter status.
- Follow-up, campaigns, prayer, AI governance, and admin pages backed by the repository contract.
- Responsive mobile navigation and record views across all routes.

## Near-term Build Order

1. Confirm hosting/account ownership before Vercel deployment.
2. Decide backend path: Supabase fast path, Neon/Clerk portable path, or AWS enterprise path.
3. Implement the selected repository adapter behind `PrmRepository`.
4. Add staff auth and role-aware access.
5. Connect partner CSV import and payment import workflows.
6. Connect WhatsApp/SMS/email provider adapters after board decision.
7. Add supervised AI tools only after permissions, audit, and approval flows are live.
