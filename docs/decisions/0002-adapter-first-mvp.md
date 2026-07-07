# Decision 0002 - Adapter-first MVP

Date: 2026-07-07

## Decision

Use adapter boundaries for messaging and data access. Keep the MVP database-free by default and serve the first dashboard from typed mock repositories.

## Rationale

The board needs to understand and validate the operating model before the team commits to a database platform. A full database too early would create migration and data-model churn while the ministry is still confirming workflows, roles, import sources, and communication rules.

Adapters let the app move in phases:

- `mock` data for board demos and product iteration.
- Supabase, Neon/Postgres, or Aurora/Postgres later behind the same repository interface.
- Mock messaging for demos.
- Twilio and Meta Cloud API later behind the same messaging interface.

## Consequences

- The first MVP can run locally with no backend credentials.
- Product demos are fast and safe because no real partner data is required.
- We still preserve a clean path to production data and provider integrations.
- Repository methods must stay business-oriented, not provider-oriented.

## Current Adapter Names

- Data: `BENMP_DATA_PROVIDER=mock | supabase | postgres`
- Messaging: `BENMP_MESSAGING_PROVIDER=mock | twilio | meta-cloud-api`

## Future Work

- Add `SupabaseDashboardRepository` only after the partner/giving schema is confirmed.
- Add `PostgresDashboardRepository` if the board chooses Neon or AWS Aurora.
- Add `TwilioMessagingAdapter` for pilot speed.
- Add `MetaCloudApiMessagingAdapter` for long-term WhatsApp ownership.
