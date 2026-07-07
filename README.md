# BENMP PRM

Internal Partner Relationship Management for BENMP and the Healing Jesus Campaign.

The app is a staff-only workspace for partner profiles, giving records, campaign support, prayer requests, communication, and follow-up. The public BENMP registration and donation flow can remain separate; this system is the operating console behind the work.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase planned for Postgres, Auth, RLS, Storage, and Edge Functions
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
- `supabase/migrations` - database schema drafts

## Current State

The first screen is a static product foundation using realistic mock data. It validates the dashboard information architecture before real auth, database, imports, or integrations are wired.

## Near-term Build Order

1. Supabase schema and local seed data
2. Auth and role-based shell
3. Partners module
4. Giving records and imports
5. Follow-up tasks and prayer requests
6. Campaigns and communication segments
7. WhatsApp/SMS/email provider adapters
8. AI assistant and supervised agent workflows
