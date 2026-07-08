# Handoff

## Current Status

Created the initial BENMP PRM workspace in `/Users/davidantwi/Dev/benmp-prm`.

Completed:

- Next.js 16 app scaffolded.
- Workspace docs added for model-agnostic agent collaboration.
- Product brief, research notes, architecture, AI-native roadmap, and initial decision record added.
- Supabase initial schema draft added.
- AI SDK 7 installed as a future provider-agnostic layer.
- Board meeting brief added with MVP talk track, backend options, and WhatsApp tradeoffs.
- Data and messaging adapter contracts added. MVP defaults to mock providers.
- Sidebar routes now have working MVP pages: partners, giving, communication, follow-up, campaigns, prayer, AI assist, and admin.
- Frontend rebuilt around a broad `PrmRepository` contract instead of page-local mock arrays.
- Core pages now use operational records: partners, contributions, payment imports, segments, message batches, tasks, campaigns, prayer requests, AI workflows, providers, roles, and backend readiness.
- Partner search/filter is URL-backed and ready to become a backend query.
- Shared responsive record renderer added so all routes work on mobile without page overflow.
- Toy demo panels removed.
- Home navigation is now "Today" and includes an operations console.
- The Today console is now the first operational surface and supports temporary browser-local actions: record gift, draft acknowledgement, capture partner, assign follow-up, stage message batch, mark acknowledgement sent, mark task done, queue message, and reset local changes.
- Today was simplified from a crowded three-column view into focused workflows with URL-backed modes: `?mode=gift`, `?mode=partner`, `?mode=task`, and `?mode=message`.
- Long-form analytics moved from Home into `/reports`, so the dashboard is now a daily command center instead of one long reporting page.
- Meeting notes from the board discussion are captured: MoMo-led intake, instant thank-you, $60 active-year threshold, $100 high-touch threshold, personalized updates, and provider-adapter architecture.

## Current Product Assumption

This is a staff-only PRM for BENMP and Healing Jesus Campaign operations. It should not depend on partners logging into an app.

## Next Actions

1. Confirm unresolved product questions with David/client.
2. Confirm the Vercel account/team that should own the preview deployment.
3. Decide backend path: Supabase fast path, Neon/Clerk portable path, or AWS enterprise path.
4. Implement the selected database adapter behind `PrmRepository`.
5. Add auth shell, staff roles, and role-aware access.
6. Replace Today console `localStorage` persistence with server actions/API calls backed by the selected repository.
7. Implement payment webhook adapter for Flutterwave/Hubtel/Paystack into `payment_events`.
8. Replace local Today gift recording with server actions/API calls backed by `contributions`.
9. Connect partner CSV import and payment import workflows.
10. Add communication provider adapters after WhatsApp/SMS/email decision.
11. Introduce AI assistant with read-only tools, then draft tools with approval.

## Open Questions

- Should the first real backend sync with the existing BENMP website/database or start as a clean internal database with imports?
- Which provider should be first for WhatsApp: Twilio or direct Meta Cloud API?
- Which provider should be first for Mobile Money intake: Flutterwave, Hubtel, Paystack, or a combination?
- What exact local-currency equivalents should define active-year and high-touch thresholds?
- Will staff need multi-region data restrictions from day one?
- What currencies and payment providers must be supported at launch?
- Is the official GitHub repo name `benmp-prm`, `benmp-partners-platform`, or something more branded?
