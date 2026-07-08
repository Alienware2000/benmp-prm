# Security And Privacy

> Baseline controls for BENMP PRM. This doc is the acceptance gate for auth, RLS, payment intake, messaging consent, AI approval, and sensitive ministry data.

## 1. Security Posture

BENMP PRM handles money records, partner PII, prayer requests, WhatsApp/SMS/email communication, and AI-assisted workflows. The safe default is:

- Staff-only access.
- Least privilege by role.
- RLS on operational tables.
- Verified payment evidence before contribution creation.
- Human approval before bulk send, sensitive send, AI mutation, or AI send.
- Audit logs for all sensitive operations.
- No secrets or real partner exports in git.

## 2. Authentication

Phase 1A target:

- Supabase Auth with email/password.
- All app routes protected except login and future provider webhook routes.
- `profiles.id` references `auth.users(id)`.
- `profiles.is_active = false` disables staff privilege through helper functions.

Requirements:

- Sessions must be cookie-based through Supabase SSR helpers.
- Login, logout, and expired-session redirects must be tested.
- Service-role key must be available only in trusted server code.
- Future password reset and MFA policy should be configured in Supabase before production launch.

## 3. Roles

| Role                   | Main Use                  | Sensitive Capabilities                                   |
| ---------------------- | ------------------------- | -------------------------------------------------------- |
| `super_admin`          | Full system owner         | User roles, settings, provider config, all records.      |
| `admin`                | Operational admin         | Broad management, approvals, reports.                    |
| `finance`              | Giving and reconciliation | Contributions, payment events, imports, finance reports. |
| `communications`       | Messaging and campaigns   | Segments, templates, batches, message approvals.         |
| `regional_coordinator` | Future regional work      | Region-scoped partner/follow-up queues once enabled.     |
| `prayer_team`          | Prayer care               | Prayer requests and approved care responses.             |
| `viewer`               | Read-only review          | No writes.                                               |

Phase 1 rule:

- All staff may read broad operational data unless a table is explicitly finance/prayer/admin scoped.
- Roles govern writes.
- Regional coordinator scoping is designed but deferred.

## 4. Row-Level Security

`0001_initial_schema.sql` enables RLS on all operational tables.

Implementation requirements:

- Every new table must enable RLS in the same migration that creates it.
- Every table must have explicit select/insert/update/delete policies or a documented denial.
- Viewer write attempts must fail.
- Finance-only tables must stay finance/admin scoped.
- Prayer-sensitive data must stay prayer/admin scoped.
- Regional scoping must be tested before coordinator accounts are enabled.

Acceptance tests:

- Unauthenticated staff route redirects to login.
- Viewer cannot create/update a partner, contribution, import, task, or message batch.
- Finance can access giving workflows.
- Communications can manage message workflows without finance-only writes.
- Prayer team cannot see finance-only data by default.

## 5. Payment And Webhook Security

Contribution creation is high-risk. Rules:

- Never create a contribution directly from browser form state.
- Every money path first creates or references a `payment_events` row.
- Provider webhooks must verify signatures.
- Provider transactions should be re-queried before promotion when possible.
- Bad signatures return 4xx and do not write promoted state.
- Replays are idempotent and create no duplicate contribution.
- Statement imports require row-level dedupe.
- Manual entries use the same promotion path and audit trail as webhooks.

Provider expectations:

| Provider          | Security Requirement                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Paystack          | Verify `x-paystack-signature` using HMAC-SHA512 and secret. Re-query transaction before promotion.       |
| Stripe            | Verify Stripe webhook signature using raw request body. Handle checkout and invoice events idempotently. |
| Hubtel            | Verify signed callbacks per provider docs once account is approved.                                      |
| Statement imports | Store row evidence, dedupe by stable hash, reconcile with staff audit.                                   |

SMS parsing is not a payment security control and must never be treated as ledger evidence.

## 6. Messaging Consent And Approval

Messaging can create reputational and pastoral risk. Rules:

- Every outbound send checks channel consent and opt-out status.
- Bulk sends require a named staff approver.
- WhatsApp production sends must respect template category and approval state.
- STOP/opt-out handling must be honored for SMS/WhatsApp once inbound messaging is live.
- Prayer broadcasts or messages sent in Bishop Dag's name require a second named approver.
- AI-generated drafts must pass through the same approval queue as human-created drafts.
- Approval is per batch or per policy, never per message: a named approver covers an entire batch regardless of size, and later an approved policy (template + segment + cadence) can cover recurring runs — with automatic re-approval on template/category change or unusual segment size, so scale never erodes the human gate.

No implementation may add a "send anyway" path outside the adapter and approval system.

## 7. AI Safety

AI is allowed only in stages:

1. Read-only analyst.
2. Drafting assistant.
3. Approved operator.
4. Workflow agent.

Rules:

- AI tools use `PrmRepository`, not direct database access from prompts.
- AI inherits the invoking staff user's role and scope.
- Scheduled AI uses a dedicated service identity with a minimal toolset.
- Mutate/send tools require approval envelopes.
- AI runs must be logged in `ai_runs`.
- Prompts containing partner data are sensitive operational data.
- Partner notes, prayer requests, and free-text imports are untrusted input.
- AI must refuse requests to bypass RLS, approval, consent, or audit logging.

## 8. Data Privacy

Sensitive data classes:

| Data                    | Handling                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Partner contact details | Staff-only, no public pages, no test screenshots with real data.                   |
| Giving history          | Finance/admin scoped where practical; reports aggregate unless staff needs detail. |
| Prayer requests         | Sensitive by default; prayer/admin scoped.                                         |
| Provider payloads       | Server-side only; redact secrets before logging.                                   |
| Statements/import files | Do not commit; store only needed parsed evidence.                                  |
| AI prompts and outputs  | Treat as sensitive if they contain partner data.                                   |
| Public prototype data   | Do not copy public PII exposure patterns from `benmp-app.vercel.app`.              |

## 9. Secrets

Secrets must live in environment variables or provider secret stores, never in source.

Current `.env.example` keys include:

- `NEXT_PUBLIC_APP_URL`
- `BENMP_DATA_PROVIDER`
- `BENMP_MESSAGING_PROVIDER`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_GATEWAY_API_KEY`
- `BENMP_DEFAULT_MODEL`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_WHATSAPP_SENDER`
- `RESEND_API_KEY`

Planned keys should be added only when the integration lands, for example Stripe, Hubtel, Meta Cloud API, or pawaPay.

## 10. Input Validation

Use Zod or equivalent structured validation for:

- Partner import rows.
- Statement import rows.
- Reconciliation actions.
- Manual gift entries.
- Message batch creation.
- Provider webhook payload shapes after signature verification.
- AI tool arguments.

Validation failures should return predictable errors and not partially write operational state.

## 11. Audit Logging

Audit log required for:

- Partner import and duplicate merge decisions.
- Payment event promotion.
- Reconciliation match/create/dismiss actions.
- Contribution corrections.
- Acknowledgement approval and sends.
- Bulk message approvals and sends.
- Prayer response actions.
- Staff role changes.
- Provider setting changes.
- AI approval acceptance.
- Feature kill-switch changes.

Audit entries should include actor, action, entity table, entity id, before/after where practical, and timestamp.

## 12. Operational Checklist

- [ ] All staff pages protected.
- [ ] Provider webhook routes bypass staff auth but verify provider signatures.
- [ ] RLS enabled on every new table.
- [ ] Viewer write negative test passes.
- [ ] Finance-only data cannot be modified by communications-only staff.
- [ ] Prayer-sensitive records are not broadly writable.
- [ ] Webhook replay creates no duplicate contribution.
- [ ] Statement re-import creates no duplicate rows/contributions.
- [ ] Bulk send cannot dispatch without named approval.
- [ ] AI cannot send or mutate without approval.
- [ ] Secrets are absent from git history and browser bundles.
- [ ] Real partner exports and statements are absent from git.
- [ ] Public prototype PII exposure is not copied into this system.
