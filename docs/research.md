# Research Notes

Last updated: 2026-07-07.

## BENMP Public Flow

Sources:

- https://benmp.com/new/
- https://benmp.com/new/registration.php
- https://benmp.com/new/donation.php
- https://benmp.com/new/admin/login.php
- https://benmp.com/registration/

Findings:

- BENMP means Beautiful, Exciting, Nice, Mood-Changing Partner.
- The public experience already supports partner registration, monthly donation, one-time donation, multilingual navigation, Paystack monthly donation links, and PayPal/card/mobile money paths.
- The registration flow collects name, country, church/denomination style fields, phone, email, payment mode, and monthly amount.
- The admin login page describes a backend for pages, donations, partners, and campaigns, with eventual role-based permissions, 2FA, and Paystack reconciliation.

Product implication:

- The custom app should be the internal operating console. It should not force partners to use a new app.

## Healing Jesus Campaign Context

Sources:

- https://daghewardmills.org/healingjesuscampaign/
- https://www.daghewardmills.org/
- https://www.daghewardmills.org/events
- https://www.daghewardmills.org/about

Findings:

- Healing Jesus Campaign is a mass evangelism effort founded by Evangelist Dag Heward-Mills in 2004.
- The campaign context includes crusades, field reports, testimonies, medical missions, pastors/leaders conferences, prayer requests, YouTube/media, and campaign archives.
- Upcoming event pages list Banjul, The Gambia on Jul 7-10, 2026 and Assomada, Cape Verde on Jul 15-17, 2026.
- Public pages show slightly different aggregate counts across pages, such as countries/campaigns/souls won. Treat those as public marketing/reporting figures, not database truth.

Product implication:

- Campaigns/crusades should be first-class internal records, with funding, partner segments, reports, and message history attached.

## Existing HJC Portal Inspiration

Source:

- https://github.com/Alienware2000/HJC-Portal

Findings:

- The old portal is a Next/Supabase/Tailwind/shadcn operational dashboard.
- Useful patterns: dark fixed sidebar, compact stat cards, searchable tables, CSV imports/exports, role-based auth, audit log, and staff/admin separation.
- The data model is conference-specific and should not be reused directly.

Product implication:

- Reuse the back-office visual feel and operational discipline, not the itinerary schema.

## Internal CRM And Workflow UX

Sources:

- https://www.nngroup.com/articles/dashboards-preattentive/
- https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-record-form.html
- https://knowledge.hubspot.com/tasks/create-tasks
- https://design-system.service.gov.uk/patterns/question-pages/
- https://carbondesignsystem.com/patterns/forms-pattern/
- https://carbondesignsystem.com/patterns/empty-states-pattern/
- https://atlassian.design/foundations/spacing

Findings:

- Operational dashboards should surface at-a-glance signals for immediate action, not become the place where every object, form, and report competes for attention.
- Mature CRM patterns separate record capture, record review, task queues, and reporting. Salesforce record-form patterns reinforce that staff should see a focused create/edit form instead of manually assembled crowded panels.
- HubSpot task workflows show why follow-up should be created from selected records and then managed in a queue.
- GOV.UK question-page patterns support reducing form friction by focusing the user on the current input or task, especially when the user is under time pressure.
- Carbon form patterns treat dedicated pages, side panels, and dialogs as separate choices based on task complexity; this app's partner capture deserves a full-width surface.
- Empty-state guidance matters for the production version: first-use pages should explain what comes next without pretending seeded data is real ministry data.
- Spacing is functional, not decorative. Dense back-office tools still need enough whitespace to show relationships and prevent staff errors.

Product implication:

- The Today workspace should behave like an operations queue: choose one of three jobs, complete that job, and let the rest of the dashboard become supporting context.
- Seeded data should be minimized in the primary workflow and eventually replaced by empty states, imports, or live records from the selected backend.

## Payments

Sources:

- https://paystack.com/docs/payments/subscriptions/
- https://paystack.com/docs/payments/webhooks/

Findings:

- Paystack subscriptions support recurring billing through plans and subscriptions.
- Paystack sends subscription and invoice events including subscription creation, charge success, invoice creation, invoice payment failure, invoice update, subscription not-renewing, and subscription disabled.
- Paystack notes failed subscription charge handling and card-expiry webhook scenarios.

Product implication:

- Payment imports/webhooks should update partner giving status, flag failed recurring gifts, and create finance follow-up tasks.

## WhatsApp, SMS, And Communication

Sources:

- https://whatsappbusiness.com/products/platform-pricing/
- https://www.twilio.com/docs/whatsapp
- https://www.twilio.com/docs/messaging

Findings:

- WhatsApp Business Platform pricing is based on delivered messages, destination market, and message category.
- Categories include marketing, utility, authentication, and service.
- Service conversations are user-initiated windows; outbound ministry updates and appeals may be marketing or utility depending on content and consent.
- Twilio can provide WhatsApp, SMS, and eventually voice/call workflows behind one provider interface.

Product implication:

- Track consent, opt-outs, channel preference, message category, template approval status, and delivery status.
- Use provider adapters so the ministry can switch between Meta direct, Twilio, or another provider.

## AI And Agentic Direction

Sources:

- https://ai-sdk.dev/docs/introduction
- https://ai-sdk.dev/docs/foundations/tools
- https://ai-sdk.dev/docs/agents/overview
- https://vercel.com/blog/ai-sdk-7

Findings:

- AI SDK is provider-agnostic and supports multiple model providers.
- AI SDK 7 is current as of this research pass and targets production agent work: tool context, approvals, durable workflow agents, telemetry, and integration with external agent harnesses.
- AI SDK 7 requires Node.js 22 or later; this machine has Node 26.

Product implication:

- Install AI SDK 7 now, but introduce AI as a supervised layer after the data model is stable.
- First tools should be read-only or draft-only. Data mutations and sends require approval.

## Supabase And Next

Sources:

- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/features/row-level-security
- Local Next 16 docs in `node_modules/next/dist/docs/`.

Findings:

- Supabase SSR uses cookie-aware server clients.
- RLS is the right place for granular staff authorization.
- Next 16 calls middleware-style request interception `proxy.ts`.

Product implication:

- Use Supabase Auth + RLS for staff roles and regional scoping.
- Add `src/proxy.ts` when route protection begins.
