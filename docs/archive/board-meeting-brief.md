# Board Meeting Brief

Date: 2026-07-07

## What This MVP Shows

The MVP is a staff-only Global Crusade Partners Platform for BENMP and the Healing Jesus Campaign.

It is not a public app for partners. Staff use it to manage:

- Donation intake from Mobile Money, card, and bank transfer
- Instant thank-you acknowledgement after a successful gift
- Partner profiles
- Giving and recurring partner health
- Campaign/crusade support
- Follow-up queues
- Prayer requests
- WhatsApp, SMS, email, and later phone workflows
- AI-assisted drafts, briefings, and reconciliation after the data foundation is stable

The first demo does not need a full production database. It can run from typed mock data while the board confirms the real workflow, fields, roles, and reporting needs.

## Meeting Talk Track

1. We are not replacing the ministry relationship. We are giving staff a better memory and operating system for it.
2. Partners do not need to be tech savvy. Staff can still reach them by WhatsApp, SMS, email, or phone.
3. The first phase is the data foundation: partners, giving, campaigns, follow-up, prayer, audit logs, and roles.
4. Payment intake should trigger stewardship: verify the gift, match the donor, send a personal thank-you, classify the donor, and create any follow-up.
5. AI comes after that foundation: partner briefings before calls, message drafts, payment reconciliation suggestions, and follow-up recommendations.
6. AI actions should be supervised. The system may draft or suggest, but staff approves sends and data changes.

## Donation And Care Rules Discussed

- BENMP baseline: $5/month.
- $60 or local equivalent means the donor has effectively covered the BENMP year and should be marked active.
- $100 or board-defined local equivalent should trigger high-touch care: faster personal call, special acknowledgement, and future campaign/report attention.
- Every donor should still be thanked and eligible for a call; the threshold prioritizes limited staff time.
- Messages should not feel generic. Templates should merge name, amount, campaign, giving history, and appropriate tone.

## Payment Provider Direction

The system should not assume one universal payment provider. Build a payment adapter just like the messaging adapter.

Near-term:

- Start with Flutterwave if the existing office prototype is already using Flutterwave test mode for MTN Mobile Money.
- Keep Hubtel as a serious Ghana-first MoMo option.
- Keep Paystack for card, bank transfer, Ghana dedicated virtual accounts, and broader regional coverage.

Architecture rule:

- Provider webhook -> raw payment event -> verification -> partner match -> contribution record -> acknowledgement -> care task if needed.

## Backend Options

The app should use a database adapter. That means the MVP can start with mock data and later swap in Supabase, Neon/Postgres, or AWS Aurora/Postgres without rewriting the dashboard and business workflows.

### Option A - Supabase

Best for fastest MVP. It gives Postgres, auth, row-level security, storage, functions, and realtime in one stack. The risk is platform coupling: auth, database API, storage, and functions are tied together.

Recommendation: good for MVP and early production if the board values speed.

### Option B - Neon Postgres + Clerk/Auth.js + Vercel

Best for a modern, portable Postgres app. Neon gives serverless Postgres with autoscaling, branching, and instant restore. Clerk adds strong staff auth, organizations, roles, and permissions. More pieces to assemble, but less tied to one backend platform.

Recommendation: a strong long-term alternative if we want portability and clean development branching.

### Option C - AWS Aurora PostgreSQL + Cognito + S3 + Lambda/SES

Best for enterprise robustness. Aurora Serverless supports automatic capacity scaling, readers, Multi-AZ, global databases, and RDS Proxy. This is the most scalable and institutionally durable route, but it is slower and more expensive to build and maintain.

Recommendation: best if HJC expects enterprise governance, compliance, dedicated cloud ownership, and a larger technical budget.

### Option D - Firebase / Firestore

Best for realtime/mobile-first apps. Firestore is scalable and flexible, but it is NoSQL. BENMP PRM has relational data: partners, contributions, recurring commitments, campaigns, tasks, segments, audit logs. Those fit Postgres better.

Recommendation: not my first choice for this system.

## My Backend Recommendation

For today: keep the MVP database-free and adapter-backed. Use mock data for the meeting and workflow validation.

After board alignment: choose Supabase as the fastest production path unless the board has a strong enterprise-cloud requirement.

For long-term: design the app so the database is ordinary Postgres and business logic is not trapped in Supabase-only features. If the board wants maximum robustness, the mature path is AWS Aurora PostgreSQL plus separate auth and services.

## WhatsApp Integration Tradeoffs

### Twilio

Pros:

- Faster onboarding and developer experience.
- WhatsApp, SMS, and voice can be handled through one provider family.
- Good for prototyping and a phased rollout.
- Handles a lot of provider plumbing, webhooks, and messaging abstractions.

Cons:

- Extra provider layer and likely extra markup.
- Some WhatsApp account/number management goes through Twilio.
- Long-term control is lower than going direct.
- Migration can be needed later if the ministry wants direct Meta ownership.

### Meta Cloud API Direct

Pros:

- Direct relationship with the official WhatsApp Business Platform.
- Better long-term control over WABA, templates, webhooks, phone numbers, and pricing visibility.
- Avoids a third-party messaging abstraction layer.
- Cleaner long-term architecture for a global ministry if technical support exists.

Cons:

- More setup and operational responsibility.
- Business verification, templates, webhooks, rate/category rules, quality ratings, and error handling are on us.
- SMS and voice still require separate providers.
- Slower for a demo or first pilot.

## My WhatsApp Recommendation

Build an internal messaging adapter from day one. That lets us start with Twilio if speed matters, then move or add direct Meta Cloud API without rewriting the product.

Strategically, I lean Meta Cloud API direct for the long term, especially if HJC expects high volume, global operations, and ownership of the WhatsApp infrastructure. But the board should decide based on expected volume, technical support, timeline, and compliance comfort.

## Sources

- WhatsApp Business Platform pricing: https://whatsappbusiness.com/products/platform-pricing/
- Twilio WhatsApp docs: https://www.twilio.com/docs/whatsapp/api
- Neon docs: https://neon.com/docs/introduction
- AWS Aurora Serverless docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html
- Clerk Organizations docs: https://clerk.com/docs/nextjs/guides/organizations/getting-started
- Firebase Firestore docs: https://firebase.google.com/docs/firestore
- AI SDK docs: https://ai-sdk.dev/docs/introduction
- AI SDK 7 announcement: https://vercel.com/blog/ai-sdk-7
