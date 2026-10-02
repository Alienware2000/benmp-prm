# BENMP PRM

**Global Crusade Partners Platform**: the partner management system for BENMP and the Healing Jesus Campaign.

BENMP supports a worldwide network of ministry partners who give monthly. This platform is where those partners are registered, where their giving is reconciled, and where the office stays in touch with them. It is live in production at **benmp-prm-seven.vercel.app**.

It is two applications sharing one database:

|                             | Who uses it                                                             | What they do                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Hub portal** (`/hub`)     | One admin per hub: 97 hubs across UD Ghana, UJ Ghana, Africa and Europe | Upload their partner lists from Excel or CSV, fix problems before saving, see and manage their own partners            |
| **Office console** (`/poc`) | BENMP office staff                                                      | Partner directory, giving ledger and statement uploads, who to call, WhatsApp and SMS messaging, a read-only assistant |

Partners themselves never log in. They give through the channels they already use (MoMo, bank, Paystack) and are contacted on WhatsApp or SMS.

---

## How it is organised

```
Region  ─▶  Hub  ─▶  Branch  ─▶  Partner
UD Ghana      31 hubs, numbered 1–31 (Takoradi, Ayawaso, …)
UJ Ghana      26 hubs, named (Bawku, Tamale North, …)
Africa        33 hubs, one per country (Kenya, Burundi, …)
Europe         7 hubs, one per denomination (MSCI, CIDC, Tell Them, …)
```

A **region** is data, not code (Decision 0020). Adding a country or a denomination is a seed entry plus an idempotent SQL paste; no deploy is needed. Each hub has an approved **branch** list (with each branch's senior pastor), and every partner a hub uploads must belong to one of those branches.

---

## The hub portal

**Sign-in.** Admins choose their region and hub from dropdowns and enter a password. The first password is the hub's name (or number for UD Ghana), and changing it is forced at first sign-in. Sessions are signed cookies; passwords are hashed with scrypt.

**Upload wizard** (Excel `.xlsx` or CSV), in four steps:

1. **Upload** the file.
2. **Columns.** Pick which column holds the name, WhatsApp number, branch (and MoMo number in Ghana). The wizard guesses from the headers; column titles in the file don't matter.
3. **Check and fix.** Every row is validated in the browser, and the server repeats exactly the same checks on save. Each flagged row shows the reason underneath it in plain words, and admins correct values in place.
4. **Saved.** Only clean rows are written, with a full audit trail of the original file.

The rules, each with a decision record in `docs/decisions.md`:

- **Names:** at least two names per person.
- **Branch:** must match the hub's approved list, ignoring case, spacing and hidden characters from Excel.
- **MoMo number:** Ghana regions only. A strict Ghana mobile check (02x/05x) (0026).
- **WhatsApp number:** read in the hub's own country. In Malawi `0999 123 456` means `+265 999 123 456`; numbers Excel has stripped of the `+` or the leading `0` are recovered (0027).
- **Same person:** a partner is their name **and** their number. Uploading the same person again updates them. The same name with a different number is a different person and is added; nobody is ever overwritten on a name alone (0028).
- **Other hubs:** a number already registered to another hub is blocked, so no hub can take over another's people.

**Partners page.** Search, filter by upload, tick people (or a whole upload) and remove them. Anyone with giving on record is protected, and every removal is copied to `audit_log` first (0029).

**Settings.** Hub details, the hub leader's name, password change, and last sign-in.

## The office console

- **Directory.** Every partner, searchable and filterable by branch and country.
- **Giving.** Upload statements (MoMo, Ecobank, Paystack one-time and recurring), review and accept matches, and see the ledger with totals that always reconcile. Payments are matched to partners by phone. Giving that matches no one is shown as unattributed, not dropped.
- **Who to call.** Top, consistent and ordinary givers derived from the ledger.
- **Messages.** WhatsApp (WaliChat) and SMS (FlashSMS Africa) to cohorts such as paid, unpaid, top givers and new partners, or one person. Staff see the SMS cost before sending. Sends are previewed and need an explicit confirm, and a send allowlist (`BENMP_SEND_ALLOWLIST`) restricts real sends during testing. Media (pictures, video, documents) comes from a Supabase Storage vault.
- **Ask.** A read-only assistant. Figures are computed in code, and the model only explains them; it never sees the whole directory and cannot send or change anything.

## What the pipeline enforces

- **No live payment provider.** Money arrives wherever partners send it, and the office uploads the statement (Decision 0007).
- **Money is stored as integer minor units**, never floating point.
- **Providers sit behind adapters.** WhatsApp and SMS have eight adapters (WaliChat, FlashSMS, Twilio, Meta Cloud, Infobip, Vonage, WhatChimp, mock), switched by environment variable.

---

## Stack

- **Next.js 16** (App Router, `src/proxy.ts` as the request gate), **React 19**, **TypeScript**, **Tailwind CSS 4**.
- **Supabase Postgres**, called directly over PostgREST with the service role. There is no ORM (Decision 0006). SQL migrations in `supabase/migrations/` are the schema of record; `docs/db-schema.md` describes it.
- **Vercel** hosting. Every merge to `main` deploys to production.
- **Vitest**: about 500 tests across 50 files.
- **AI:** a model registry (`src/lib/ai`), currently Gemini Flash for the office assistant, swappable by configuration.

## Repository map

```
src/app/hub/              Hub portal pages (upload wizard, partners, settings, password)
src/app/poc/              Office console pages (dashboard, directory, giving, calls, messages)
src/app/api/hub/          Hub APIs: parse, check, submit, partner removal, password, account
src/app/api/poc/          Office APIs: send, giving upload/review, media, ask
src/app/api/regions       Public region and hub list for the login picker
src/lib/hub/              Hub rules: ingest validation, auth, sessions, seeds, removal, calling codes
src/lib/poc/              Office logic: directory, giving, reconciliation, insights, audiences, SMS cost
src/lib/phone.ts          Phone normalisation to E.164
src/lib/messaging/        WhatsApp and SMS provider adapters
supabase/migrations/      Database schema (apply in order)
scripts/                  Seed loaders, exports, one-off sends, SQL helpers
scripts/data/             Committed seed lists: hubs, branches and pastors per region
docs/                     Requirements, schema, decisions, API, deployment, operations
```

The top-level pages `/admin`, `/ai`, `/campaigns`, `/communication`, `/follow-up`, `/giving`, `/partners`, `/prayer` and `/reports` are the original July prototype on mock data. They are kept as design reference, are not connected to live data, and are not what staff use.

## Running it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

The essential variables:

| Variable                                                | Purpose                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database                                                       |
| `POC_PASSWORD`                                          | Office staff shared password                                   |
| `HUB_SESSION_SECRET`                                    | Signs hub admin sessions                                       |
| `BENMP_MESSAGING_PROVIDER`, `WALI_*`, `FLASHSMS_*`      | Messaging; leave unset to use the mock adapter                 |
| `BENMP_SEND_ALLOWLIST`                                  | Comma-separated numbers; when set, real sends only reach these |
| `GOOGLE_GENERATIVE_AI_API_KEY`, `BENMP_POC_MODEL`       | Office assistant                                               |

`.env.example` lists every provider's variables. Real credentials never go in git.

## Before you merge

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

A change is done when its test is green and the docs it affects are updated in the same PR:

- schema → `docs/db-schema.md`
- routes → `docs/api-spec.md`
- decisions → `docs/decisions.md`
- deviations from the plan → `docs/phases.md`

Work goes through pull requests to `main`; merging deploys.

## Working with production data

- **Hubs, branches and logins** come from `scripts/data/*-hubs-churches.json`. Production is updated with idempotent SQL that is safe to re-run and never resets a password someone has chosen. To add a region, add a hub, or rename one, change the seed file and apply the matching SQL.
- **Real partner data never enters the repository.** Source spreadsheets from hubs stay outside git.
- **Removing partners or branches** never deletes anyone with giving on record, and removed partners are copied to `audit_log`.

## Documentation

Start at [`docs/README.md`](docs/README.md). The most useful after that:

- [`docs/decisions.md`](docs/decisions.md): why things are the way they are (30 decisions).
- [`docs/db-schema.md`](docs/db-schema.md): the data contract.
- [`docs/api-spec.md`](docs/api-spec.md): every route.
- [`docs/ops-runbook.md`](docs/ops-runbook.md): how the office uses it day to day.

## Status

|          |                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live** | Hub portal for all four regions; office console with directory, giving, calls, messaging and the assistant.                                                                     |
| **Next** | Fixing a wrong branch across many rows in one step, with remembered spellings per hub; letting hub admins manage their own branch lists; a "possible duplicates" review screen. |

Built by David Antwi and Charlie ([@charlieboye96](https://github.com/charlieboye96)) for BENMP, from July 2026.
