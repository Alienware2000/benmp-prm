# Decision 0001 - Foundation And AI Sequencing

Date: 2026-07-07

## Decision

Build BENMP PRM as a staff-only internal Partner Relationship Management platform first, then add AI-native workflows after the core data model is stable.

## Rationale

The ministry needs reliable partner, giving, campaign, prayer, communication, and follow-up records. AI will be much more useful and safer after those records are structured. Starting with autonomous messaging or generalized chat would create risk without solving the operational foundation.

## Consequences

- The first app screen is an operations dashboard, not a marketing site.
- Supabase schema and RLS are first-class architecture concerns.
- AI SDK 7 is installed and documented, but not yet used for production workflows.
- Future AI tools are categorized as read-only, draft-only, or mutation tools with approval requirements.

## Alternatives Considered

- Airtable-first: faster but less controllable for long-term AI, integrations, and role scoping.
- Generic CRM customization: lower build effort but weaker fit for crusades, prayer requests, country coordinators, giving health, and ministry-specific communication.
- AI chatbot first: exciting but premature without clean operational data.
