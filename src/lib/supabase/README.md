# Supabase Layer

This directory will hold Supabase browser, server, and admin clients.

Planned files:

- `client.ts` - browser client for client components.
- `server.ts` - cookie-aware SSR client for server components/actions.
- `admin.ts` - service-role client for trusted server-only operations.

Do not import service-role credentials into client components.
