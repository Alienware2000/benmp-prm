# Cash Payment Form — Design Spec

_Date: 2026-10-06_
_Subsystem: #1 of the monthly-money reconciliation suite (cash / upload-hardening / money-aggregation / partner-overview / executive-summary-export)._

## 1. Goal

A **public, no-login, one-shared-link** web form that lets every BENMP church report its monthly cash collections. The form writes to Supabase through a validated server route (never via the anon key directly), produces an immutable submission record, and can be promoted by staff into the existing `payments` ledger so cash appears alongside MoMo and bank money in all downstream reporting.

This is the first of five PRs. It introduces **cash as a new payment source** — the only intake channel that is a human-filled form rather than a CSV export.

## 2. Context & constraints

- **Decision 0007**: money enters only via intake (CSV import today); no live payment provider. Cash is a new intake channel in the same spirit — a structured form instead of a CSV.
- **Existing hierarchy** (Decision 0020, migration 0010): `regions → hubs (denomination/group) → hub_churches (church) → partners`. The form's cascading dropdowns follow this exact chain.
- **Existing public-RLS pattern** (migration 0012, `intake_submissions`): anyone can insert; only authenticated staff can read/update. `current_staff_role()` helper exists. This spec reuses that pattern verbatim for the cash tables.
- **Existing region/hub list** (`src/lib/hub/db.ts:listRegionsForLogin`, served at `GET /api/regions`): returns regions + hubs that have login accounts. The cash form needs **all** hubs (a church's hub may not have an account yet), so a separate public endpoint without the account filter is required.
- **Existing hub-church fetch** (`src/lib/hub/db.ts:147`): `hub_churches?hub_id=eq.{id}&select=id,name,name_key`. Already queryable; needs a public wrapper route.
- **Existing ledger** (`payments` table, POC): rows are inserted idempotently with `on_conflict=reference`. Cash promotion reuses this — same ledger, same downstream aggregation.
- **Summary numbers are manual** (user decision 2026-10-06): Total Registered / Active / New / Lapsed are typed by the church (their local register is authoritative; the office DB may be incomplete per church). The executive summary's `Active = total GHS ÷ 12 ÷ 5` is a **separate derived figure** computed only in the export (subsystem #5), not stored on the submission.

## 3. Data model

### 3.1 `cash_submissions` — one monthly form per church

```sql
create table public.cash_submissions (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id),
  hub_id uuid not null references public.hubs(id),
  church_id uuid not null references public.hub_churches(id),
  reporting_month date not null,               -- always the 1st of the month
  total_registered int not null default 0,
  active_partners int not null default 0,       -- manual (church's own count)
  new_registrations int not null default 0,
  lapsed int not null default 0,
  total_cash_minor bigint not null default 0,   -- computed sum of giver amounts (pesewas)
  currency text not null default 'GHS',
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted'
    check (status in ('submitted', 'promoted', 'flagged')),
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, reporting_month)           -- one form per church per month = no double-count
);
```

Indexes: `(church_id, reporting_month)` (unique), `(hub_id)`, `(region_id)`, `(status)`, `(submitted_at desc)`.

### 3.2 `cash_submission_givers` — the giver list (form section 2 + 3)

```sql
create table public.cash_submission_givers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.cash_submissions(id) on delete cascade,
  row_index int not null,
  giver_name text,
  giver_phone text,                             -- raw; normalized to E.164 server-side for matching
  amount_minor bigint not null check (amount_minor >= 0),
  transaction_ref text,                         -- receipt/transaction ID; optional but unique when present
  created_at timestamptz not null default now(),
  unique (submission_id, transaction_ref)       -- no duplicate receipt refs within a submission
  -- partial: only enforced where transaction_ref is not null (Postgres treats NULLs as distinct)
);
```

Index: `(submission_id)`.

### 3.3 No double-counting — three layers

1. **`unique (church_id, reporting_month)`** on `cash_submissions` — a church cannot file twice for the same month. A second submit returns 409.
2. **`unique (submission_id, transaction_ref)`** on `cash_submission_givers` — no duplicate receipt numbers within one form.
3. **Promotion idempotency** — each giver promotes to `payments` with `reference = 'cash_submission:{submissionId}:{giverId}'`. The existing `on_conflict=reference` makes re-promotion a no-op.

### 3.4 RLS — mirrors `intake_submissions` (migration 0012)

```sql
alter table public.cash_submissions enable row level security;
alter table public.cash_submission_givers enable row level security;

-- Public insert (the form writes here via the server route using service role;
-- the policy allows anon insert as a backstop, matching intake_submissions).
create policy cash_submissions_insert_public
  on public.cash_submissions for insert with check (true);
create policy cash_submission_givers_insert_public
  on public.cash_submission_givers for insert with check (true);

-- Staff-only read.
create policy cash_submissions_select_staff
  on public.cash_submissions for select
  using (auth.role() = 'authenticated');
create policy cash_submission_givers_select_staff
  on public.cash_submission_givers for select
  using (auth.role() = 'authenticated');

-- Staff-only update (promotion status change).
create policy cash_submissions_update_staff
  on public.cash_submissions for update
  using (public.current_staff_role() in ('super_admin', 'admin', 'finance'));
```

`updated_at` trigger reuses the existing `public.set_updated_at()` function.

## 4. Routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /cash` | public | the form page |
| `GET /api/cash/regions` | public | all regions + all hubs (no account filter) |
| `GET /api/cash/hubs?regionCode=` | public | hubs in a region |
| `GET /api/cash/churches?hubId=` | public | churches in a hub |
| `POST /api/cash/submit` | public, rate-limited | submit a completed form |
| `GET /api/cash/submissions` | staff | list submissions (for subsystem #4 monitoring) |
| `POST /api/cash/:id/promote` | staff (finance/admin) | promote giver rows to `payments` |

All public routes are added to `src/lib/public-paths.ts` (the single tested gate — forgetting this breaks the form, as documented in that file's header).

### 4.1 Cascading dropdown endpoints

`GET /api/cash/regions` returns:
```json
{
  "ok": true,
  "regions": [
    { "code": "UD_GHANA", "name": "UD Ghana", "hubIdentifier": "number" },
    { "code": "UJ_GHANA", "name": "UJ Ghana", "hubIdentifier": "name" }
  ]
}
```

`GET /api/cash/hubs?regionCode=UD_GHANA` returns:
```json
{ "ok": true, "hubs": [{ "id": "…", "label": "Hub 8 - Cape Coast" }] }
```

`GET /api/cash/churches?hubId=…` returns:
```json
{ "ok": true, "churches": [{ "id": "…", "name": "Qodesh" }] }
```

These carry only the office's structural data (region/hub/church names and ids) — no counts, no partner data, no account state. Same safety posture as `/api/regions` (documented in `public-paths.ts`).

### 4.2 `POST /api/cash/submit` — validation gates

Request body:
```json
{
  "regionCode": "UD_GHANA",
  "hubId": "…",
  "churchId": "…",
  "reportingMonth": "2026-10",
  "summary": { "totalRegistered": 120, "activePartners": 80, "newRegistrations": 5, "lapsed": 3 },
  "givers": [
    { "name": "Kofi Mensah", "phone": "0244123456", "amountMinor": 2000, "transactionRef": "R001" },
    { "name": "Ama Serwaa", "phone": "", "amountMinor": 5000, "transactionRef": "" }
  ]
}
```

Server-side validation (client state is untrusted — same posture as `/api/hub/ingest/submit`):

1. **Chain integrity**: `hub.region_id = region.id` and `church.hub_id = hub.id`. Reject 400 if broken.
2. **`reportingMonth`**: valid, first-of-month, not in the future.
3. **Summary counts**: each ≥ 0. Soft warning (not a block) if `totalRegistered < activePartners + newRegistrations` (logically inconsistent but not impossible — the church may count differently).
4. **Giver rows** (at least one required):
   - `name` ≥ 2 chars OR `phone` present (a row must identify someone).
   - `amountMinor` ≥ 0 (integer pesewas; the client sends minor units to avoid float parsing).
   - `transactionRef`: optional, but if present must be unique within the payload (server dedups before insert; the DB unique index is the backstop).
5. **Idempotency**: if `(church_id, reporting_month)` already exists → 409 with `{ ok: false, error: "already_submitted" }`.
6. **Rate limit**: per-IP, 5 submissions per 15 minutes. Minimal in-memory map (cleared on server restart — acceptable for a monthly form; upgrade to Upstash if abuse appears). Returns 429 with `Retry-After`.

On success: insert `cash_submissions` + all `cash_submission_givers` in a single transaction (service role). Return `{ ok: true, submissionId }`.

### 4.3 `POST /api/cash/:id/promote` — staff action

Auth-gated (finance/admin/super_admin). For each giver row, insert into `payments`:
```
reference:        'cash_submission:{submissionId}:{giverId}'
paid_at:          {submission.submitted_at}
status:           'Successful'
payer_name:       giver.giver_name
payer_phone_e164: normalizePhone(giver.giver_phone)
amount_minor:     giver.amount_minor
currency:         'GHS'
payment_method:   'cash'                        -- column added in migration 0016
raw_row:          { source: 'cash_submission', submission_id, church_id, hub_id, region_id, transaction_ref, _payment_method: 'cash' }
```

Note: the existing `buildPaymentRows` helper (`src/lib/poc/payment-upload.ts`) builds `PocPaymentInsertRow` which does not include a top-level `payment_method` field (it puts it in `raw_row._payment_method`). The cash promote route writes rows directly to `payments` (not via `buildPaymentRows`) so it can set the `payment_method` column explicitly. The `raw_row` also carries `_payment_method` for consistency with existing rows that read the method from there.
Idempotent on `reference` (existing `on_conflict=reference` + `resolution=ignore-duplicates`). After insert, verify with `assertPaymentRowsExist` (the helper added in PR #87). Mark `cash_submissions.status = 'promoted'`, set `promoted_at`.


Promotion is **manual**, not automatic — matches the CSV import's preview→commit ritual and keeps the ledger clean until staff confirm the submission is genuine.

## 5. The form UI (`/cash`)

Single Next.js page, no login. Client component with server-rendered shell.

**Section 1 — Identity:**
- Region dropdown (loads `/api/cash/regions` on mount).
- Hub dropdown (loads `/api/cash/hubs?regionCode=` when region selected; disabled + cleared until region chosen).
- Church dropdown (loads `/api/cash/churches?hubId=` when hub selected; disabled + cleared until hub chosen).
- Reporting month (default: current month, `<input type="month">`).

**Section 2 — Summary (manual):**
- Total Registered, Active Partners, New Registrations, Lapsed — four number inputs, all ≥ 0.

**Section 3 — Giver list:**
- Repeatable rows: Name, Phone, Amount (GHS, displayed as cedis but sent as minor units), Transaction/Receipt Ref (optional).
- "Add row" / "Remove row" buttons.
- Live total of giver amounts displayed; compared against a "Total cash received" sanity field (soft warning if mismatch — not a hard block).

**Submit** → `POST /api/cash/submit` → success screen with submission ID, or inline validation errors.

## 6. Testing

### Unit (`src/lib/cash/cash-validation.test.ts`)
- Region→hub→church chain validation: valid chain passes; mismatched hub/church rejected.
- `reportingMonth` parsing: `"2026-10"` → `2026-10-01`; future month rejected.
- Giver row validation: empty name + empty phone rejected; amount < 0 rejected; duplicate `transactionRef` within payload rejected.
- Idempotency: re-submitting same `(church_id, month)` → `already_submitted`.

### Integration (`src/app/api/cash/submit/route.test.ts`)
- POST valid payload → 201, rows in `cash_submissions` + `cash_submission_givers`, `total_cash_minor` = sum of giver amounts.
- POST duplicate month → 409.
- POST broken chain (church from wrong hub) → 400.
- Promote → `payments` rows with `payment_method='cash'`; re-promote → no duplicates; `assertPaymentRowsExist` passes.

### E2E (Playwright, `tests/cash-form.spec.ts`)
- Load `/cash` → region dropdown populated → select region → hub dropdown populates → select hub → church dropdown populates → select church.
- Fill summary + 2 giver rows → submit → success screen.
- Submit again for same church+month → duplicate error.

## 7. Files touched

```
supabase/migrations/0021_cash_submissions.sql          (new — schema + RLS)
src/lib/public-paths.ts                                 (add /cash + /api/cash/* public routes)
src/lib/cash/cash-validation.ts                         (new — validation logic)
src/lib/cash/cash-validation.test.ts                    (new — unit tests)
src/app/cash/page.tsx                                   (new — form page)
src/app/cash/cash-form.tsx                              (new — client component)
src/app/api/cash/regions/route.ts                       (new — public)
src/app/api/cash/hubs/route.ts                          (new — public)
src/app/api/cash/churches/route.ts                      (new — public)
src/app/api/cash/submit/route.ts                        (new — public, rate-limited)
src/app/api/cash/submissions/route.ts                   (new — staff list)
src/app/api/cash/[id]/promote/route.ts                  (new — staff promote)
docs/db-schema.md                                       (add cash tables)
docs/api-spec.md                                        (add cash routes)
```

## 8. Out of scope (deferred to other subsystems)

- **#2 Upload hardening** — audit trail + dedup for the CSV import flow (separate PR).
- **#3 Money aggregation** — MoMo + bank + cash per church → country → region (reads `payments` including promoted cash rows; separate PR).
- **#4 Partner overview** — partners per church / group / country (reads existing `partners` table; separate PR).
- **#5 Executive summary export** — USD @ 1:12, Active = total ÷ $5 (reads `payments` including cash; separate PR).
- Cash giver matching to existing partners (phone→partner) — handled at promotion time using the existing `matchNormalizedRows` logic, but full reconciliation UI is part of #2/#3.

## 9. Migration number

`0021_cash_submissions.sql` — next available (latest existing is `0020_add_pamela_admin_exclusion.sql`).

## 10. Open notes

- **Rate limiting**: in-memory map is the MVP. If the form sees abuse, swap to Upstash Redis (already a common Vercel pattern). The validation module takes a `rateLimiter` interface so the swap is one line.
- **Currency**: cash is GHS-only for now. The `currency` column exists for a future multi-currency church, but the form sends `GHS` and the exec summary's 1:12 rate is GHS→USD.
- **"All hubs" vs "hubs with accounts"**: the cash form's region/hub endpoint skips the `hasAccount` filter that `/api/regions` applies (a church's hub may not have a login yet). This is the one behavioral difference and it's deliberate.