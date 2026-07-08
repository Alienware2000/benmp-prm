# AI-native Roadmap

## Principle

Make the app AI-native by giving AI safe access to structured ministry operations data. Do not build autonomous messaging before the PRM foundation is trustworthy.

## Model-agnostic Strategy

- Use AI SDK 7 as the model/provider abstraction.
- Keep provider names in environment/config, not scattered through business logic.
- Define AI tools in application language: partner search, giving summary, campaign lookup, segment preview, draft message, reconcile import.
- Separate read tools, draft tools, and mutation tools.
- Require approval for mutation tools and all outbound sends.

## Phases

### Phase 1 - Read-only Assistant

Use cases:

- Summarize a partner before a phone call.
- Explain why a partner is in a follow-up queue.
- Generate a country coordinator brief from existing dashboard data.
- Answer operational questions such as "How many Ghana monthly partners missed June?"

Requirements:

- Authenticated staff only.
- RLS-scoped data access.
- No write tools.
- Conversation and generated summary logs.

### Phase 2 - Drafting Assistant

Use cases:

- Draft WhatsApp, SMS, and email variants for a segment.
- Turn a campaign report into partner updates.
- Draft birthday greetings and monthly thank-you messages.
- Rewrite messages for tone, length, and channel constraints.

Requirements:

- Staff reviews before send.
- Template/category metadata for WhatsApp.
- Consent and opt-out checks.
- Message versions saved before dispatch.

### Phase 3 - Operational Agent

Use cases:

- Reconcile Paystack exports.
- Create suggested follow-up tasks.
- Detect partner record duplicates.
- Build segments from natural language.

Requirements:

- Tool approvals for data changes.
- Audit logs for every agent suggestion and accepted action.
- Human-readable diff before mutation.

### Phase 4 - Workflow Agent

Use cases:

- Monthly partner appreciation workflow.
- Failed recurring payment workflow.
- New partner welcome workflow.
- Crusade support appeal workflow.

Requirements:

- Durable runs.
- Retries and idempotency.
- Rollback or cancellation controls.
- Observability and cost tracking.

## Agent Architecture (added 2026-07-08 — the agentic consolidation)

The client wants the system agentic. These are the load-bearing design elements across all phases:

- **Agent core**: one loop (AI SDK 7 `generateText`/agent primitives) + one tool registry + one policy layer, reused by three surfaces: interactive chat, scheduled runs (monthly cycle), and event-triggered tasks (e.g. high-touch gift → caller brief). Never fork per-surface agents.
- **Tool tiers**: every tool declares `read | draft | mutate | send`. The executor — not the prompt — enforces: `read` runs freely within the caller's RLS scope; `draft` writes only to review queues; `mutate`/`send` produce an **approval envelope** (a pending-action record with a human-readable diff/preview) and halt. A staff approval mints the token that lets the executor complete the action. Bulk sends need a named approver; prophet-category needs two.
- **Identity**: interactive runs execute as the invoking staff user (their role, their RLS). Scheduled/event runs execute as a dedicated `agent` service identity with an explicitly enumerated minimal toolset — never the service-role key.
- **Untrusted input**: partner-authored text (prayer requests, claims, notes, inbound messages) is delimited as quoted data in prompts. Assume prompt injection; the envelope model is the real defense.
- **Memory**: the PRM database is the memory. Retrieval = repository queries (partner brief, history, message log). No embeddings/vector store until a concrete retrieval need is demonstrated.
- **Cost model**: template+merge for bulk personalization; LLM generation reserved for high-touch tiers, briefs, reconciliation, and reports. Per-run token/cost budgets recorded in `ai_runs`; model tier per task via the registry (cheap drafter / strong analyst).
- **Observability + evals**: `ai_runs` stores messages, tool calls, model, tokens, cost, and outcome. Golden-question eval set (the five headline board questions) runs against seed data in CI. Suggestion-inbox accept/reject decisions are logged for eval/improvement.
- **Kill-switches**: `app_settings` flags gate auto-send, scheduled runs, and the watchdog independently.

## Guardrails

- AI may draft; staff decides.
- AI may suggest tasks; staff approves.
- AI may read only the data allowed by the staff user's role.
- AI may not send messages, export personal data, or mutate financial records without explicit approval.
- All prompts that include partner details are sensitive operational data.

## Candidate Tool Names

- `searchPartners`
- `getPartnerBrief`
- `previewSegment`
- `draftPartnerMessage`
- `summarizeCampaign`
- `suggestFollowUps`
- `reconcilePaymentImport`
- `findDuplicatePartners`
- `createApprovedTasks`
- `queueApprovedMessages`
