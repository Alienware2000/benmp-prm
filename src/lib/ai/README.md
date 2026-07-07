# AI Layer

AI is planned after the core PRM foundation is stable.

The app should use AI SDK 7 as the provider-agnostic boundary. Model choice belongs in configuration, not business logic.

Tool classes:

- Read-only tools: search, summarize, explain.
- Draft tools: generate message drafts, segment descriptions, coordinator briefs.
- Mutation tools: create tasks, update records, queue messages. These require explicit staff approval.

Never let an AI workflow bypass Supabase RLS, consent checks, or audit logging.
