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

- `AGENTS.md` - canonical project instructions for Codex, Claude Code, Cursor, and other agents
- `CLAUDE.md` - imports `AGENTS.md`
- `docs/README.md` - documentation front door and status
- `docs/srs.md` - requirements lock file
- `docs/db-schema.md` - human-readable database schema contract
- `docs/design-spec.md` - product, architecture, payments, AI, and UI reference
- `docs/delivery-plan.md` - build phases and copy-paste agent prompts
- `docs/decisions.md` - decision log
- `docs/security.md` - auth, RLS, webhook, messaging, AI, privacy, and audit controls
- `docs/deployment.md` - Vercel/Supabase setup, env vars, migrations, backups, release checklist
- `docs/api-spec.md` - planned API, server-action, and webhook contract
- `docs/ops-runbook.md` - practical BENMP office workflow guide
- `docs/archive/` - historical planning context
- `src/lib/data` - data repository adapters
- `src/lib/messaging` - WhatsApp/SMS/email provider adapters
- `supabase/migrations` - Postgres/Supabase schema migrations

## Current State

The app is repository-driven across the core PRM modules. The current adapter is a typed mock seed repository, but every page now reads through the same `PrmRepository` contract that a Supabase/Postgres backend should implement.

Current working surfaces:

- Operational overview with staff queue, giving momentum, country summaries, campaign readiness, and backend readiness.
- Today operations console with focused local browser workflows for capturing a partner, assigning follow-up, and staging message batches before the backend is connected.
- Donation-first Today workflow for recording a gift, drafting the thank-you, and flagging active-year or high-touch care based on giving thresholds.
- Partner directory with URL-backed search/filtering and mobile-friendly record cards.
- Giving ledger with payment import batches, provider references, acknowledgement status, donor attention tiers, reconciliation status, and follow-up triggers.
- Reports route for longer giving momentum, country portfolio, campaign readiness, and backend readiness views.
- Messaging center with segments, approval batches, compliance checks, and provider adapter status.
- Follow-up, campaigns, prayer, AI governance, and admin pages backed by the repository contract.
- Responsive mobile navigation and record views across all routes.

The Today console persists temporary actions in browser `localStorage` under `benmp-prm-local-workspace-v1`. This is intentionally a thin client-side bridge for MVP review; production persistence should move behind `PrmRepository` and server-side auth.

The Today workflow is intentionally the front door: acknowledge a gift, capture a partner, assign follow-up, or approve messaging. Longer analytics and portfolio views live under Reports so the first screen feels operational instead of seeded-data heavy.

## Near-term Build Order

1. Confirm hosting/account ownership before Vercel deployment.
2. Decide backend path: Supabase fast path, Neon/Clerk portable path, or AWS enterprise path.
3. Implement the selected repository adapter behind `PrmRepository`.
4. Add staff auth and role-aware access.
5. Connect partner CSV import and payment import workflows.
6. Connect WhatsApp/SMS/email provider adapters after board decision.
7. Add supervised AI tools only after permissions, audit, and approval flows are live.
