# Handoff

## Current Status

Created the initial BENMP PRM workspace in `/Users/davidantwi/Dev/benmp-prm`.

Completed:

- Next.js 16 app scaffolded.
- First internal dashboard screen built with realistic mock data.
- Workspace docs added for model-agnostic agent collaboration.
- Product brief, research notes, architecture, AI-native roadmap, and initial decision record added.
- Supabase initial schema draft added.
- AI SDK 7 installed as a future provider-agnostic layer.
- Board meeting brief added with MVP talk track, backend options, and WhatsApp tradeoffs.

## Current Product Assumption

This is a staff-only PRM for BENMP and Healing Jesus Campaign operations. It should not depend on partners logging into an app.

## Next Actions

1. Confirm unresolved product questions with David/client.
2. Decide backend path: Supabase fast path, Neon/Clerk portable path, or AWS enterprise path.
3. Build database local setup and seed data.
4. Replace mock dashboard data with typed database queries.
5. Add auth shell and role-aware navigation.
6. Build partners module first.
7. Add giving import/reconciliation second.
8. Add follow-up/prayer/campaign modules.
9. Add communication provider adapters.
10. Introduce AI assistant with read-only tools.

## Open Questions

- Should the system sync with the existing BENMP website/database or start as a clean internal database with imports?
- Which provider should be first for WhatsApp: Twilio or direct Meta Cloud API?
- Will staff need multi-region data restrictions from day one?
- What currencies and payment providers must be supported at launch?
- Is the official GitHub repo name `benmp-prm`, `benmp-partners-platform`, or something more branded?
