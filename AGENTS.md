<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BENMP PRM Agent Guide

## Project

BENMP PRM is an internal Partner Relationship Management system for BENMP and the Healing Jesus Campaign. It is staff-facing: the ministry team uses it to manage partners, giving, prayer requests, campaigns, communication, and follow-up across WhatsApp, SMS, email, and phone workflows.

## Working Principles

- Treat `WORKSPACE.md`, `docs/handoff.md`, and `docs/decisions/` as the portable source of truth for all coding agents.
- Prefer small, verifiable changes. Update docs when product architecture or workflow decisions change.
- Keep public donor experiences separate from this internal staff workspace unless a task explicitly bridges them.
- Build the PRM foundation first: partners, giving, campaigns, communication history, follow-up tasks, imports/exports, roles, audit logs.
- Keep AI provider-agnostic. Use the AI SDK layer for model calls when AI is introduced, and isolate provider selection behind configuration.
- Never store payment card data, WhatsApp tokens, API keys, or private partner information in git.

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
- Shared static demo data currently lives in `src/lib/dashboard-data.ts`.
- Supabase schema drafts live in `supabase/migrations`.
- AI architecture notes live in `docs/ai-native-roadmap.md` and `src/lib/ai`.
