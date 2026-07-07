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
