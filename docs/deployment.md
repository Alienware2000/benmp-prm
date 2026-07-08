# Deployment

> Deployment and operations setup for the first live BENMP PRM environment. Target: Vercel web app plus Supabase Postgres/Auth, with provider adapters added phase by phase.

## 1. Environments

Use at least three environments:

| Environment | Purpose                                          | Data                                                                                  |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Local       | Developer work and mock demos.                   | Mock data or sanitized fixtures only.                                                 |
| Preview     | Vercel preview branches and integration testing. | Test Supabase project or test schema; no real statements unless access is restricted. |
| Production  | BENMP staff live workspace.                      | Real partner and giving records.                                                      |

Do not point previews at production Supabase unless branch isolation and permissions are intentionally configured.

## 2. Hosting Split

| Responsibility      | Recommended Owner                                               |
| ------------------- | --------------------------------------------------------------- |
| Web app hosting     | Vercel project under the correct account.                       |
| Database/auth       | Supabase project controlled by BENMP or agreed technical owner. |
| Payment providers   | BENMP legal entity/provider accounts.                           |
| Messaging providers | BENMP-owned Twilio/Meta/Resend accounts.                        |
| Secrets             | Vercel environment variables and Supabase secret storage.       |

## 3. Repository Commands

Current scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run format:check
```

Acceptance before deployment:

```bash
npm run typecheck
npm run lint
npm run build
```

## 4. Vercel Setup

1. Create or select the correct Vercel account/project.
2. Connect the `Alienware2000/benmp-prm` GitHub repository.
3. Use the default Next.js framework preset.
4. Configure environment variables per environment.
5. Deploy preview.
6. Verify staff pages render under `BENMP_DATA_PROVIDER=mock`.
7. Switch preview to Supabase only after Phase 1A repository/auth lands.

Important:

- The current app has no route protection yet. Do not treat a deployed preview as private until Phase 1A auth is implemented or Vercel protection is enabled.
- Do not upload real partner exports to an unprotected preview.

## 5. Supabase Setup

Phase 1A target:

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_initial_schema.sql`.
3. Add `0002_foundation_config.sql` with region blocks, settings, `partners.region_block_id`, and `contributions.usd_equivalent`.
4. Create initial staff users.
5. Insert matching `profiles` rows with roles.
6. Enable and verify RLS policies.
7. Configure Supabase Auth redirect URLs for local, preview, and production.

Manual verification:

- A `super_admin` can log in.
- A `viewer` can log in but cannot write.
- Authenticated staff can load staff pages.
- Unauthenticated users are redirected away from app routes once route protection lands.

## 6. Environment Variables

Current keys from `.env.example`:

| Variable                        | Environment    | Notes                                                   |
| ------------------------------- | -------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           | All            | Public app base URL.                                    |
| `BENMP_DATA_PROVIDER`           | All            | `mock`, `supabase`, or future `postgres`. Default mock. |
| `BENMP_MESSAGING_PROVIDER`      | All            | `mock`, `twilio`, or future `meta-cloud-api`.           |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase envs  | Public Supabase URL.                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase envs  | Public anon key; RLS still protects data.               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only    | Never expose to client bundles.                         |
| `AI_GATEWAY_API_KEY`            | AI envs        | Model gateway/API key.                                  |
| `BENMP_DEFAULT_MODEL`           | AI envs        | Defaults to `gateway:auto` in code.                     |
| `PAYSTACK_SECRET_KEY`           | Payment envs   | Server only.                                            |
| `PAYSTACK_WEBHOOK_SECRET`       | Payment envs   | Server only.                                            |
| `TWILIO_ACCOUNT_SID`            | Messaging envs | Server only.                                            |
| `TWILIO_AUTH_TOKEN`             | Messaging envs | Server only.                                            |
| `TWILIO_MESSAGING_SERVICE_SID`  | Messaging envs | Server only.                                            |
| `TWILIO_WHATSAPP_SENDER`        | Messaging envs | Server only.                                            |
| `RESEND_API_KEY`                | Messaging envs | Server only.                                            |

Add later when implemented:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `HUBTEL_CLIENT_ID`
- `HUBTEL_CLIENT_SECRET`
- `HUBTEL_WEBHOOK_SECRET`
- `META_WHATSAPP_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_VERIFY_TOKEN`
- `PAWAPAY_API_KEY`, only if triggered

## 7. Provider Webhook URLs

Planned routes:

| Provider       | URL Shape                      | Environment                             |
| -------------- | ------------------------------ | --------------------------------------- |
| Paystack       | `/api/webhooks/paystack`       | Preview and production after Phase 2A.  |
| Stripe         | `/api/webhooks/stripe`         | Preview and production after Phase 2A.  |
| Twilio status  | `/api/webhooks/twilio/status`  | Phase 3.                                |
| Twilio inbound | `/api/webhooks/twilio/inbound` | Phase 3 claim loop if triggered.        |
| Hubtel         | `/api/webhooks/hubtel`         | When Hubtel merchant setup is approved. |

Rules:

- Webhook routes are not staff-authenticated.
- Webhook routes must verify provider signatures.
- Preview webhook endpoints must use test provider accounts.

## 8. Database Migration Workflow

Current repo has raw SQL migrations under `supabase/migrations`.

Expected workflow:

1. Write a new migration file.
2. Apply to local/test Supabase.
3. Update `docs/db-schema.md` in the same change when domain shape changes.
4. Run app typecheck/lint/build.
5. Apply to preview.
6. Smoke test.
7. Apply to production during a planned release window.

Rules:

- Never edit a migration that has already been applied to production.
- Add a new migration instead.
- Do not store production database dumps in the repo.

## 9. Seed And Imports

Initial seed should include:

- `super_admin` profile.
- `viewer` profile for permission negative test.
- Region blocks.
- App settings thresholds.
- Minimal message templates.

Partner import:

- Office partner Excel exports should be converted to CSV outside git.
- Use sanitized fixtures for tests.
- Real imports should run only in authenticated staff context.

Statement import:

- Real statements are sensitive financial records.
- Store parsed rows/evidence in the database, not raw files in git.
- Keep upload files in protected storage if retention is required.

## 10. Scheduled Jobs

Not required in Phase 1A.

Planned jobs:

| Job                            | Phase | Candidate Runtime                                 |
| ------------------------------ | ----- | ------------------------------------------------- |
| Statement import reminders     | 2B    | Staff workflow first; automation later.           |
| Message batch dispatch         | 3     | Vercel cron or Supabase scheduled function.       |
| Month-close snapshots          | 5     | Vercel cron route or Supabase scheduled function. |
| Lapsed partner task generation | 5     | Same job as month-close or follow-up worker.      |
| Webhook replay review          | 6     | Admin-triggered job plus dead-letter queue.       |

Pick one runtime per job and document why when implemented.

## 11. Backup And Recovery

Before production:

- Confirm Supabase backup plan and retention.
- Document restore process.
- Run one restore drill into a non-production project.
- Export and store migration history.
- Document who can access backups.

Recovery expectations:

- Payment webhooks are replay-safe.
- Statement imports are deduped.
- Manual corrections are audited.
- Month-close snapshots can be backfilled from contributions if needed.

## 12. Release And Rollback

Release checklist:

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Migrations applied to preview.
- [ ] Auth smoke test passes.
- [ ] Viewer write negative test passes.
- [ ] Webhook fixture tests pass for any changed provider.
- [ ] Reconciliation fixture test passes for import changes.
- [ ] AI read-only refusal test passes for AI changes.
- [ ] Docs updated for changed behavior.

Rollback:

- Prefer rolling back Vercel deployment for app-only issues.
- Database rollbacks require explicit migration planning; do not rely on destructive down migrations.
- If a webhook bug created bad data, pause provider webhook processing, fix idempotent replay logic, and correct data with audited scripts.

## 13. Go-Live Checklist

- [ ] Correct Vercel account confirmed.
- [ ] Production domain chosen.
- [ ] Supabase ownership confirmed.
- [ ] Staff user list approved.
- [ ] Initial roles assigned.
- [ ] Provider test credentials configured.
- [ ] Merchant onboarding documents submitted.
- [ ] Public prototype exposing PII taken down or gated.
- [ ] Real partner export received securely.
- [ ] Backup/restore plan confirmed.
- [ ] Support owner named for first live week.
