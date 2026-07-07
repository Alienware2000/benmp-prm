# BENMP PRM Workspace

Plain markdown front door for any agent working in this repo.

## Mission

Build a staff-only Global Crusade Partners Platform for BENMP and the Healing Jesus Campaign. The system should help the ministry steward partner relationships across countries: profiles, giving, campaigns, prayer requests, communication, follow-up, imports/exports, and later AI-assisted workflows.

## Current Phase

Foundation. Do not overbuild AI before the core PRM data model is trustworthy.

## Canonical Context

Read in this order:

1. `AGENTS.md`
2. `docs/handoff.md`
3. `docs/product-brief.md`
4. `docs/architecture.md`
5. `docs/ai-native-roadmap.md` when touching AI features
6. `supabase/migrations/0001_initial_schema.sql` when touching data

## Repo Conventions

- Keep workspace memory in portable markdown, not in a vendor-specific memory system.
- Keep `CLAUDE.md` as an import of `AGENTS.md`; update `AGENTS.md` first.
- Add durable technical decisions to `docs/decisions/`.
- Treat real partner and payment data as sensitive. Use seed/mock data in git.
- Provider-specific integrations should sit behind adapter boundaries.

## Development

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run format:check
```

## Naming

- Repo/folder: `benmp-prm`
- Internal product: `BENMP PRM`
- UI title: `Global Crusade Partners Platform`
