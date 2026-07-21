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
| AI model            | GCP project with **Vertex AI** enabled (Claude in Model Garden) + a service account. |
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

Phase 1 target (just Supabase — Decision 0006):

1. Create a Supabase project.
2. Apply the SQL migrations under `supabase/migrations/` (authoritative), then generate types with `supabase gen types typescript`.
3. Seed via `npm run db:seed` (region blocks, `app_settings` thresholds, staff profiles, minimal templates).
4. Create initial staff users in Supabase Auth.
5. Insert matching `profiles` rows with roles.
6. Enable and verify RLS policies (the authorization gate).
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
| `BENMP_MESSAGING_PROVIDER`      | All            | `mock`, `twilio`, `meta-cloud-api`, `infobip`, or `vonage`. |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase envs  | Public Supabase URL.                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase envs  | Public anon key; RLS backstops data.                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only    | Never expose to client bundles. Bypasses RLS — trusted server code only. |
| `GOOGLE_VERTEX_PROJECT`         | AI envs        | GCP project id for Claude on Vertex.                    |
| `GOOGLE_VERTEX_LOCATION`        | AI envs        | Vertex region, e.g. `us-east5`.                         |
| `GOOGLE_APPLICATION_CREDENTIALS`| Server only    | Vertex service-account (path or inline JSON); not in git.|
| `BENMP_DEFAULT_MODEL`           | AI envs        | Claude model id resolved via the registry.              |
| `TWILIO_ACCOUNT_SID`            | Messaging envs | Server only.                                            |
| `TWILIO_AUTH_TOKEN`             | Messaging envs | Server only.                                            |
| `TWILIO_MESSAGING_SERVICE_SID`  | Messaging envs | Server only.                                            |
| `TWILIO_WHATSAPP_SENDER`        | Messaging envs | Server only.                                            |
| `META_WHATSAPP_TOKEN`           | Messaging envs | Server-only Meta Cloud API access token.                |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Messaging envs | Meta sender ID, not the displayed phone number.         |
| `META_GRAPH_API_VERSION`        | Messaging envs | Optional; defaults to `v23.0`.                          |
| `VONAGE_API_KEY`                | Messaging envs | Server only; sandbox account API key.                   |
| `VONAGE_API_SECRET`             | Messaging envs | Server only; sandbox account API secret.                |
| `VONAGE_WHATSAPP_SENDER`        | Messaging envs | Sandbox sender shown in the Vonage dashboard.           |
| `VONAGE_MESSAGES_API_URL`       | Messaging envs | Optional; defaults to the Vonage v1 sandbox endpoint.   |
| `RESEND_API_KEY`                | Messaging envs | Server only.                                            |

Add later when implemented:

- `META_WHATSAPP_VERIFY_TOKEN`

There are **no payment-provider env vars** — the system integrates no payment provider (Decision 0007). Money enters via CSV upload, which needs no credentials.

## 7. Messaging Webhook URLs

The only inbound webhooks are messaging delivery/inbound callbacks — **there are no payment webhooks** (Decision 0007).

| Provider       | URL Shape                      | Environment                             |
| -------------- | ------------------------------ | --------------------------------------- |
| Twilio status  | `/api/webhooks/twilio/status`  | Phase 7.                                |
| Twilio inbound | `/api/webhooks/twilio/inbound` | Phase 7 (opt-out; claim loop if triggered). |

Rules:

- Messaging webhook routes are not staff-authenticated.
- Messaging webhook routes must verify provider signatures.
- Preview webhook endpoints must use test provider accounts.

## 8. Database Migration Workflow

Schema is hand-written SQL migrations under `supabase/migrations/` (Decision 0006, just-Supabase; `db-schema.md` is the contract).

Expected workflow:

1. Write a new migration file (enable RLS + policies in the same file as any new table).
2. Apply to local/test Supabase; regenerate types with `supabase gen types typescript`.
3. Update `docs/db-schema.md` in the same change when domain shape changes.
4. Run app typecheck/lint/test/build.
5. Apply to preview.
6. Smoke test.
7. Apply to production during a planned release window.

Rules:

- Never edit a migration already applied to production. Add a new one instead.
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
| Statement import reminders     | 7     | Staff workflow first; automation later.           |
| Message batch dispatch         | 7     | Vercel cron or Supabase scheduled function.       |
| Pledge reminder run            | 9     | Cron builds the reminder batch from unpaid pledges (no charging — Decision 0007). |
| Month-close snapshots          | 9     | Vercel cron route or Supabase scheduled function. |
| Lapsed partner task generation | 9     | Same job as month-close or follow-up worker.      |

(Phase numbers per `docs/phases.md`.)

Pick one runtime per job and document why when implemented.

## 11. Backup And Recovery

Before production:

- Confirm Supabase backup plan and retention.
- Document restore process.
- Run one restore drill into a non-production project.
- Export and store migration history.
- Document who can access backups.

Recovery expectations:

- CSV payment imports are replay-safe (re-importing a row is inert).
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
- If a bad CSV import created wrong data, stop further imports, fix the parsing/dedup logic, and correct data with audited scripts (payment_events are immutable — correct at contribution level).

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

## POC Deploy Checklist (Vercel)

Quick path to get the `/poc` console in front of the team at a shared URL. The gate
(`src/proxy.ts`) means `/poc` and `/api/poc/*` require a password once `POC_PASSWORD` is set.
Every other route — including `/` and the pre-POC mock MVP shell (`/partners`, `/giving`, …) —
redirects to `/poc` for everyone, so the old demo pages never show; only `/login` is public.

**Dashboard route (simplest):**

1. Vercel → **Add New → Project** → import `Alienware2000/benmp-prm` (Next.js auto-detected).
2. **Project Settings → Environment Variables** (Production) — add:
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - `POC_USER` (e.g. `benmp`) and **`POC_PASSWORD`** ← **required, or `/poc` is public**
   - For the Vonage demo sandbox: `BENMP_MESSAGING_PROVIDER=vonage`, `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_WHATSAPP_SENDER`, and `BENMP_SEND_ALLOWLIST`
3. **Deploy.** After this, every push to `main` auto-deploys.
4. Share `https://<project>.vercel.app/poc` + the password with the team.

**CLI route (equivalent):**

```bash
npx vercel login          # you — browser auth
npx vercel link           # link this repo to a Vercel project
# set env vars in the dashboard (keeps secrets out of the shell), then:
npx vercel --prod         # deploy
```

**Before sharing publicly, verify:** opening `/poc` prompts for the password (no prompt = `POC_PASSWORD` not set). Trial Twilio still can't send at volume — the console previews correctly regardless.
