# Cash Payment Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, no-login web form at `/cash` where every BENMP church reports monthly cash collections, writing validated submissions to Supabase that staff can promote into the existing `payments` ledger.

**Architecture:** Two new tables (`cash_submissions` + `cash_submission_givers`) with public-insert/staff-read RLS mirroring `intake_submissions` (migration 0012). Public GET endpoints serve the cascading region→hub→church dropdowns. A rate-limited `POST /api/cash/submit` validates server-side (chain integrity, dedup, idempotency). A staff-gated promote route writes cash rows into `payments` with `payment_method = 'cash'`, reusing the existing `on_conflict=reference` idempotency and `assertPaymentRowsExist` guard.

**Tech Stack:** Next.js 16 App Router, Supabase PostgREST (service role, no ORM), Vitest, TypeScript, existing `src/lib/phone.ts` + `src/lib/hub/db.ts` patterns.

**Spec:** `docs/superpowers/specs/2026-10-06-cash-payment-form-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `supabase/migrations/0021_cash_submissions.sql` | Schema: two tables, indexes, RLS policies, updated_at trigger |
| `src/lib/cash/db.ts` | PostgREST helpers: rest wrapper, region/hub/church queries, submission insert, promote |
| `src/lib/cash/validation.ts` | Pure validation: chain integrity, month parse, giver row checks, ref dedup |
| `src/lib/cash/validation.test.ts` | Unit tests for validation.ts |
| `src/lib/cash/rate-limit.ts` | Minimal in-memory per-IP rate limiter |
| `src/lib/cash/rate-limit.test.ts` | Unit tests for rate limiter |
| `src/app/api/cash/regions/route.ts` | Public GET — all regions (no account filter) |
| `src/app/api/cash/hubs/route.ts` | Public GET — hubs in a region |
| `src/app/api/cash/churches/route.ts` | Public GET — churches in a hub |
| `src/app/api/cash/submit/route.ts` | Public POST — validated submission + rate limit |
| `src/app/api/cash/submissions/route.ts` | Staff GET — list submissions |
| `src/app/api/cash/[id]/promote/route.ts` | Staff POST — promote givers to `payments` |
| `src/app/cash/page.tsx` | Server shell for the form page |
| `src/app/cash/cash-form.tsx` | Client component: cascading dropdowns, summary, giver rows, submit |
| `src/lib/public-paths.ts` | Add `/cash` + `/api/cash/regions` + `/api/cash/hubs` + `/api/cash/churches` + `/api/cash/submit` |
| `docs/db-schema.md` | Add cash_submissions + cash_submission_givers sections |
| `docs/api-spec.md` | Add cash route contracts |

---

## Task 1: Migration — cash submissions schema + RLS

**Files:**
- Create: `supabase/migrations/0021_cash_submissions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0021: Cash payment submissions — public form intake for monthly cash collections.
-- Mirrors intake_submissions (0012): public insert, staff-only read/update.
-- One submission per (church, reporting_month) — no double-count.

begin;

create table public.cash_submissions (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id),
  hub_id uuid not null references public.hubs(id),
  church_id uuid not null references public.hub_churches(id),
  reporting_month date not null,
  total_registered int not null default 0,
  active_partners int not null default 0,
  new_registrations int not null default 0,
  lapsed int not null default 0,
  total_cash_minor bigint not null default 0,
  currency text not null default 'GHS',
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted'
    check (status in ('submitted', 'promoted', 'flagged')),
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, reporting_month)
);

create index cash_submissions_hub_idx on public.cash_submissions(hub_id);
create index cash_submissions_region_idx on public.cash_submissions(region_id);
create index cash_submissions_status_idx on public.cash_submissions(status);
create index cash_submissions_submitted_at_idx on public.cash_submissions(submitted_at desc);

create table public.cash_submission_givers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.cash_submissions(id) on delete cascade,
  row_index int not null,
  giver_name text,
  giver_phone text,
  amount_minor bigint not null check (amount_minor >= 0),
  transaction_ref text,
  created_at timestamptz not null default now(),
  unique (submission_id, transaction_ref)
);

create index cash_submission_givers_submission_idx on public.cash_submission_givers(submission_id);

alter table public.cash_submissions enable row level security;
alter table public.cash_submission_givers enable row level security;

create policy cash_submissions_insert_public
  on public.cash_submissions for insert with check (true);
create policy cash_submission_givers_insert_public
  on public.cash_submission_givers for insert with check (true);

create policy cash_submissions_select_staff
  on public.cash_submissions for select
  using (auth.role() = 'authenticated');
create policy cash_submission_givers_select_staff
  on public.cash_submission_givers for select
  using (auth.role() = 'authenticated');

create policy cash_submissions_update_staff
  on public.cash_submissions for update
  using (public.current_staff_role() in ('super_admin', 'admin', 'finance'));

create trigger cash_submissions_set_updated_at
  before update on public.cash_submissions
  for each row execute function public.set_updated_at();

commit;

-- Undo:
--   begin;
--   drop trigger cash_submissions_set_updated_at on public.cash_submissions;
--   drop table public.cash_submission_givers;
--   drop table public.cash_submissions;
--   commit;
```

- [ ] **Step 2: Verify SQL is valid**

Run: `psql` or apply to a local Supabase instance. If no local DB, verify syntax by reading carefully against the existing migration patterns in `supabase/migrations/0012_intake_submissions.sql`.
Expected: no syntax errors; `current_staff_role()` and `set_updated_at()` are pre-existing functions used in 0012.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0021_cash_submissions.sql
git commit -m "feat: cash submissions migration (schema + RLS)"
```

---

## Task 2: Validation module — pure functions + tests

**Files:**
- Create: `src/lib/cash/validation.ts`
- Create: `src/lib/cash/validation.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/cash/validation.test.ts
import { describe, expect, it } from "vitest";
import {
  parseReportingMonth,
  validateGiverRow,
  validateGiverRows,
  type GiverRowInput,
  type SubmitPayload,
} from "./validation";

describe("parseReportingMonth", () => {
  it("parses a valid YYYY-MM string to the first of the month", () => {
    expect(parseReportingMonth("2026-10")).toBe("2026-10-01");
  });

  it("rejects empty or malformed strings", () => {
    expect(parseReportingMonth("")).toBeNull();
    expect(parseReportingMonth("2026")).toBeNull();
    expect(parseReportingMonth("2026-13")).toBeNull();
    expect(parseReportingMonth("garbage")).toBeNull();
  });

  it("rejects future months", () => {
    const now = new Date();
    const futureYear = now.getFullYear() + 1;
    expect(parseReportingMonth(`${futureYear}-01`)).toBeNull();
  });
});

describe("validateGiverRow", () => {
  it("passes with a name and amount", () => {
    const row: GiverRowInput = { name: "Kofi Mensah", phone: "", amountMinor: 2000, transactionRef: "R001" };
    expect(validateGiverRow(row)).toEqual({ ok: true });
  });

  it("passes with phone but no name", () => {
    const row: GiverRowInput = { name: "", phone: "0244123456", amountMinor: 5000, transactionRef: "" };
    expect(validateGiverRow(row)).toEqual({ ok: true });
  });

  it("rejects when both name and phone are empty", () => {
    const row: GiverRowInput = { name: "", phone: "", amountMinor: 2000, transactionRef: "" };
    const result = validateGiverRow(row);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("identify");
  });

  it("rejects negative amounts", () => {
    const row: GiverRowInput = { name: "Test", phone: "", amountMinor: -100, transactionRef: "" };
    const result = validateGiverRow(row);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("amount");
  });

  it("rejects a name shorter than 2 characters when no phone", () => {
    const row: GiverRowInput = { name: "A", phone: "", amountMinor: 100, transactionRef: "" };
    const result = validateGiverRow(row);
    expect(result.ok).toBe(false);
  });
});

describe("validateGiverRows", () => {
  it("passes with valid rows", () => {
    const rows: GiverRowInput[] = [
      { name: "Kofi", phone: "", amountMinor: 2000, transactionRef: "R001" },
      { name: "Ama", phone: "0244123456", amountMinor: 5000, transactionRef: "" },
    ];
    expect(validateGiverRows(rows).ok).toBe(true);
  });

  it("rejects duplicate transaction refs within the payload", () => {
    const rows: GiverRowInput[] = [
      { name: "Kofi", phone: "", amountMinor: 2000, transactionRef: "R001" },
      { name: "Ama", phone: "", amountMinor: 5000, transactionRef: "R001" },
    ];
    const result = validateGiverRows(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate");
  });

  it("allows multiple rows with empty transaction refs", () => {
    const rows: GiverRowInput[] = [
      { name: "Kofi", phone: "", amountMinor: 2000, transactionRef: "" },
      { name: "Ama", phone: "", amountMinor: 5000, transactionRef: "" },
    ];
    expect(validateGiverRows(rows).ok).toBe(true);
  });

  it("rejects an empty giver list", () => {
    expect(validateGiverRows([]).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/cash/validation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/cash/validation.ts

export type GiverRowInput = {
  name: string;
  phone: string;
  amountMinor: number;
  transactionRef: string;
};

export type SubmitPayload = {
  regionCode: string;
  hubId: string;
  churchId: string;
  reportingMonth: string;
  summary: {
    totalRegistered: number;
    activePartners: number;
    newRegistrations: number;
    lapsed: number;
  };
  givers: GiverRowInput[];
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Parse "YYYY-MM" into a "YYYY-MM-01" date string, or null if invalid/future. */
export function parseReportingMonth(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const date = new Date(Date.UTC(year, month - 1, 1));
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (date > currentMonthStart) return null;
  return `${match[1]}-${match[2]}-01`;
}

export function validateGiverRow(row: GiverRowInput): ValidationResult {
  const hasName = row.name.trim().length >= 2;
  const hasPhone = row.phone.trim().length > 0;
  if (!hasName && !hasPhone) {
    return { ok: false, error: "Each giver row must have a name (≥ 2 chars) or a phone number to identify them." };
  }
  if (row.amountMinor < 0) {
    return { ok: false, error: "Amount cannot be negative." };
  }
  return { ok: true };
}

export function validateGiverRows(rows: GiverRowInput[]): ValidationResult {
  if (rows.length === 0) {
    return { ok: false, error: "At least one giver row is required." };
  }
  for (let i = 0; i < rows.length; i++) {
    const rowResult = validateGiverRow(rows[i]);
    if (!rowResult.ok) {
      return { ok: false, error: `Row ${i + 1}: ${rowResult.error}` };
    }
  }
  const seenRefs = new Set<string>();
  for (const row of rows) {
    const ref = row.transactionRef.trim();
    if (!ref) continue;
    if (seenRefs.has(ref)) {
      return { ok: false, error: `Duplicate transaction reference: "${ref}".` };
    }
    seenRefs.add(ref);
  }
  return { ok: true };
}

export function validateSummaryCounts(summary: SubmitPayload["summary"]): ValidationResult {
  const { totalRegistered, activePartners, newRegistrations, lapsed } = summary;
  if (totalRegistered < 0 || activePartners < 0 || newRegistrations < 0 || lapsed < 0) {
    return { ok: false, error: "Summary counts cannot be negative." };
  }
  // Soft warning only — not a hard reject. The church may count differently.
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/cash/validation.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cash/validation.ts src/lib/cash/validation.test.ts
git commit -m "feat: cash submission validation module + tests"
```

---

## Task 3: Rate limiter — in-memory per-IP throttle + tests

**Files:**
- Create: `src/lib/cash/rate-limit.ts`
- Create: `src/lib/cash/rate-limit.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/cash/rate-limit.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const limiter = createFreshLimiter();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000)).toBe(true);
    }
  });

  it("blocks the 6th request within the window", () => {
    const limiter = createFreshLimiter();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000);
    }
    expect(checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000)).toBe(false);
  });

  it("allows again after the window passes", () => {
    const limiter = createFreshLimiter();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000);
    }
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000)).toBe(true);
  });

  it("tracks IPs independently", () => {
    const limiter = createFreshLimiter();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000);
    }
    expect(checkRateLimit(limiter, "5.6.7.8", 5, 15 * 60 * 1000)).toBe(true);
  });
});

// Each test gets a fresh limiter so state doesn't leak.
function createFreshLimiter(): Map<string, number[]> {
  return new Map();
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/cash/rate-limit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/cash/rate-limit.ts

/**
 * Minimal in-memory per-IP rate limiter. Accepts a Map (so tests can pass a
 * fresh one) and returns true if the IP is under the limit, false if over.
 *
 * Entries are arrays of timestamps; old timestamps are pruned on each call.
 * Not shared across server instances — acceptable for a monthly form. Swap to
 * Upstash Redis if abuse appears; the interface stays the same.
 */
export type RateLimitMap = Map<string, number[]>;

export function checkRateLimit(
  map: RateLimitMap,
  ip: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (map.get(ip) ?? []).filter((ts) => ts > cutoff);

  if (timestamps.length >= maxRequests) {
    map.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  map.set(ip, timestamps);
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/cash/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cash/rate-limit.ts src/lib/cash/rate-limit.test.ts
git commit -m "feat: in-memory rate limiter for cash form"
```

---

## Task 4: DB helpers — PostgREST queries for cascading dropdowns + submission insert + promote

**Files:**
- Create: `src/lib/cash/db.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/lib/cash/db.ts
import { normalizePhone } from "../phone";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(): Record<string, string> {
  if (!SUPABASE_URL || !KEY) {
    throw new Error("Supabase is not configured (URL / service role key missing)");
  }
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// --- Cascading dropdown data ---

export type RegionOption = { code: string; name: string; hubIdentifier: string };

export async function listAllRegions(): Promise<RegionOption[]> {
  return rest<RegionOption[]>(
    "regions?select=code,name,hub_identifier&order=sort_order.asc",
  );
}

export type HubOption = { id: string; label: string };

export async function listHubsInRegion(regionCode: string): Promise<HubOption[]> {
  const rows = await rest<
    { id: string; hub_number: number | null; name: string; regions: { code: string } | null }[]
  >(
    "hubs?select=id,hub_number,name,regions(code)" +
      `&regions.code=eq.${encodeURIComponent(regionCode)}` +
      "&order=hub_number.asc.nullslast,name.asc",
  );
  return rows.map((h) => ({
    id: h.id,
    label: h.hub_number ? `Hub ${h.hub_number} - ${h.name}` : h.name,
  }));
}

export type ChurchOption = { id: string; name: string };

export async function listChurchesInHub(hubId: string): Promise<ChurchOption[]> {
  return rest<ChurchOption[]>(
    `hub_churches?hub_id=eq.${encodeURIComponent(hubId)}&select=id,name&order=name.asc`,
  );
}

// --- Chain integrity validation ---

export async function validateChain(
  regionCode: string,
  hubId: string,
  churchId: string,
): Promise<boolean> {
  const [hub, church] = await Promise.all([
    rest<{ region_id: string; regions: { code: string } | null }[] | { region_id: string; regions: { code: string } | null }[]>(
      `hubs?select=id,region_id,regions(code)&id=eq.${encodeURIComponent(hubId)}&limit=1`,
    ),
    rest<{ hub_id: string }[]>(
      `hub_churches?select=id,hub_id&id=eq.${encodeURIComponent(churchId)}&limit=1`,
    ),
  ]);
  const hubRow = Array.isArray(hub) ? hub[0] : hub;
  if (!hubRow || !hubRow.regions || hubRow.regions.code !== regionCode) return false;
  if (!church[0] || church[0].hub_id !== hubId) return false;
  return true;
}

// --- Submission insert ---

export type GiverInsert = {
  row_index: number;
  giver_name: string | null;
  giver_phone: string | null;
  amount_minor: number;
  transaction_ref: string | null;
};

export type SubmissionInsert = {
  region_id: string;
  hub_id: string;
  church_id: string;
  reporting_month: string;
  total_registered: number;
  active_partners: number;
  new_registrations: number;
  lapsed: number;
  total_cash_minor: number;
  currency: string;
};

export async function insertSubmission(
  submission: SubmissionInsert,
  givers: GiverInsert[],
): Promise<string> {
  // PostgREST nested insert: insert the parent and children in one call.
  const body = {
    ...submission,
    cash_submission_givers: givers,
  };
  const rows = await rest<{ id: string }[]>(
    "cash_submissions?select=id",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || !row.id) throw new Error("Submission insert returned no id.");
  return row.id;
}

export async function submissionExistsForMonth(
  churchId: string,
  reportingMonth: string,
): Promise<boolean> {
  const rows = await rest<{ id: string }[]>(
    `cash_submissions?select=id&church_id=eq.${encodeURIComponent(churchId)}&reporting_month=eq.${encodeURIComponent(reportingMonth)}&limit=1`,
  );
  return rows.length > 0;
}

// --- Promotion ---

export type CashSubmissionRow = {
  id: string;
  region_id: string;
  hub_id: string;
  church_id: string;
  submitted_at: string;
  status: string;
};

export type CashGiverRow = {
  id: string;
  submission_id: string;
  giver_name: string | null;
  giver_phone: string | null;
  amount_minor: number;
  transaction_ref: string | null;
};

export async function getSubmissionForPromote(
  submissionId: string,
): Promise<{ submission: CashSubmissionRow; givers: CashGiverRow[] } | null> {
  const [subs, givers] = await Promise.all([
    rest<CashSubmissionRow[]>(
      `cash_submissions?select=id,region_id,hub_id,church_id,submitted_at,status&id=eq.${encodeURIComponent(submissionId)}&limit=1`,
    ),
    rest<CashGiverRow[]>(
      `cash_submission_givers?select=id,submission_id,giver_name,giver_phone,amount_minor,transaction_ref&submission_id=eq.${encodeURIComponent(submissionId)}&order=row_index.asc`,
    ),
  ]);
  if (!subs[0]) return null;
  return { submission: subs[0], givers };
}

export type CashPaymentRow = {
  reference: string;
  paid_at: string;
  status: "Successful";
  payer_name: string | null;
  payer_phone_e164: string | null;
  amount_minor: number;
  currency: string;
  payment_method: string;
  raw_row: Record<string, unknown>;
};

export function buildCashPaymentRows(
  submission: CashSubmissionRow,
  givers: CashGiverRow[],
): CashPaymentRow[] {
  return givers.map((g) => ({
    reference: `cash_submission:${submission.id}:${g.id}`,
    paid_at: submission.submitted_at,
    status: "Successful" as const,
    payer_name: g.giver_name,
    payer_phone_e164: normalizePhone(g.giver_phone),
    amount_minor: g.amount_minor,
    currency: "GHS",
    payment_method: "cash",
    raw_row: {
      source: "cash_submission",
      submission_id: submission.id,
      church_id: submission.church_id,
      hub_id: submission.hub_id,
      region_id: submission.region_id,
      transaction_ref: g.transaction_ref,
      _payment_method: "cash",
    },
  }));
}

export async function insertCashPayments(rows: CashPaymentRow[]): Promise<void> {
  if (rows.length === 0) return;
  await rest<void>("payments?on_conflict=reference", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  // Verify all rows landed (same guard as the CSV upload path, PR #87).
  const references = rows.map((r) => r.reference);
  const encoded = references.map((r) => encodeURIComponent(r)).join(",");
  const existing = await rest<{ reference: string }[]>(
    `payments?select=reference&reference=in.(${encoded})&limit=${references.length}`,
  );
  const present = new Set(existing.map((r) => r.reference));
  const missing = references.filter((r) => !present.has(r));
  if (missing.length > 0) {
    throw new Error(`Cash payment insert incomplete; missing ${missing.length} reference(s).`);
  }
}

export async function markSubmissionPromoted(submissionId: string): Promise<void> {
  await rest<void>(
    `cash_submissions?id=eq.${encodeURIComponent(submissionId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "promoted",
        promoted_at: new Date().toISOString(),
      }),
    },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS (no type errors in the new module).

- [ ] **Step 3: Commit**

```bash
git add src/lib/cash/db.ts
git commit -m "feat: cash submission PostgREST helpers"
```

---

## Task 5: Public paths — add cash routes to the unauthenticated gate

**Files:**
- Modify: `src/lib/public-paths.ts`

- [ ] **Step 1: Read the current file**

Run: `read src/lib/public-paths.ts`
Confirm the `isPublicPath` function and its current entries.

- [ ] **Step 2: Add the cash public routes**

Add these conditions to the `isPublicPath` return expression, after the existing `/api/regions` check:

```typescript
    pathname === "/cash" ||
    pathname === "/api/cash/regions" ||
    pathname === "/api/cash/hubs" ||
    pathname === "/api/cash/churches" ||
    pathname === "/api/cash/submit" ||
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/public-paths.ts
git commit -m "feat: add cash form routes to public paths"
```

---

## Task 6: Public dropdown endpoints — regions, hubs, churches

**Files:**
- Create: `src/app/api/cash/regions/route.ts`
- Create: `src/app/api/cash/hubs/route.ts`
- Create: `src/app/api/cash/churches/route.ts`

- [ ] **Step 1: Write the regions endpoint**

```typescript
// src/app/api/cash/regions/route.ts
import { NextResponse } from "next/server";
import { listAllRegions } from "@/lib/cash/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const regions = await listAllRegions();
    return NextResponse.json({ ok: true, regions });
  } catch (err) {
    console.error("[cash/regions] failed", err);
    return NextResponse.json({ ok: false, error: "Could not load regions." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the hubs endpoint**

```typescript
// src/app/api/cash/hubs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { listHubsInRegion } from "@/lib/cash/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const regionCode = req.nextUrl.searchParams.get("regionCode");
  if (!regionCode) {
    return NextResponse.json({ ok: false, error: "Missing regionCode." }, { status: 400 });
  }
  try {
    const hubs = await listHubsInRegion(regionCode);
    return NextResponse.json({ ok: true, hubs });
  } catch (err) {
    console.error("[cash/hubs] failed", err);
    return NextResponse.json({ ok: false, error: "Could not load hubs." }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write the churches endpoint**

```typescript
// src/app/api/cash/churches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { listChurchesInHub } from "@/lib/cash/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const hubId = req.nextUrl.searchParams.get("hubId");
  if (!hubId) {
    return NextResponse.json({ ok: false, error: "Missing hubId." }, { status: 400 });
  }
  try {
    const churches = await listChurchesInHub(hubId);
    return NextResponse.json({ ok: true, churches });
  } catch (err) {
    console.error("[cash/churches] failed", err);
    return NextResponse.json({ ok: false, error: "Could not load churches." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cash/regions/route.ts src/app/api/cash/hubs/route.ts src/app/api/cash/churches/route.ts
git commit -m "feat: public cascading dropdown endpoints for cash form"
```

---

## Task 7: Submit endpoint — validated public POST with rate limit

**Files:**
- Create: `src/app/api/cash/submit/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/cash/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  insertSubmission,
  submissionExistsForMonth,
  validateChain,
  type GiverInsert,
  type SubmissionInsert,
} from "@/lib/cash/db";
import {
  parseReportingMonth,
  validateGiverRows,
  validateSummaryCounts,
  type GiverRowInput,
  type SubmitPayload,
} from "@/lib/cash/validation";
import { checkRateLimit, type RateLimitMap } from "@/lib/cash/rate-limit";

export const dynamic = "force-dynamic";

// Module-level limiter — persists across requests in a single server instance.
const rateLimitMap: RateLimitMap = new Map();
const MAX_SUBMISSIONS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(rateLimitMap, ip, MAX_SUBMISSIONS, WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let body: SubmitPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  // Validate reporting month
  const reportingMonth = parseReportingMonth(body.reportingMonth);
  if (!reportingMonth) {
    return NextResponse.json({ ok: false, error: "Invalid or future reporting month." }, { status: 400 });
  }

  // Validate chain integrity (region → hub → church)
  const chainValid = await validateChain(body.regionCode, body.hubId, body.churchId);
  if (!chainValid) {
    return NextResponse.json(
      { ok: false, error: "The selected region, hub, or church is not valid." },
      { status: 400 },
    );
  }

  // Idempotency: one submission per church per month
  const exists = await submissionExistsForMonth(body.churchId, reportingMonth);
  if (exists) {
    return NextResponse.json(
      { ok: false, error: "already_submitted" },
      { status: 409 },
    );
  }

  // Validate summary counts
  const summaryResult = validateSummaryCounts(body.summary);
  if (!summaryResult.ok) {
    return NextResponse.json({ ok: false, error: summaryResult.error }, { status: 400 });
  }

  // Validate giver rows
  const giversResult = validateGiverRows(body.givers);
  if (!giversResult.ok) {
    return NextResponse.json({ ok: false, error: giversResult.error }, { status: 400 });
  }

  // Look up region_id from the code (the chain validation already confirmed it)
  const { listAllRegions } = await import("@/lib/cash/db");
  const regions = await listAllRegions();
  const region = regions.find((r) => r.code === body.regionCode);
  if (!region) {
    return NextResponse.json({ ok: false, error: "Region not found." }, { status: 400 });
  }

  // Build inserts
  const totalCashMinor = body.givers.reduce((sum, g) => sum + g.amountMinor, 0);
  const submission: SubmissionInsert = {
    region_id: region.id,
    hub_id: body.hubId,
    church_id: body.churchId,
    reporting_month: reportingMonth,
    total_registered: body.summary.totalRegistered,
    active_partners: body.summary.activePartners,
    new_registrations: body.summary.newRegistrations,
    lapsed: body.summary.lapsed,
    total_cash_minor: totalCashMinor,
    currency: "GHS",
  };
  const giverInserts: GiverInsert[] = body.givers.map((g, i) => ({
    row_index: i,
    giver_name: g.name.trim() || null,
    giver_phone: g.phone.trim() || null,
    amount_minor: g.amountMinor,
    transaction_ref: g.transactionRef.trim() || null,
  }));

  try {
    const submissionId = await insertSubmission(submission, giverInserts);
    return NextResponse.json({ ok: true, submissionId }, { status: 201 });
  } catch (err) {
    console.error("[cash/submit] insert failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not save the submission." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cash/submit/route.ts
git commit -m "feat: public cash submit endpoint with validation + rate limit"
```

---

## Task 8: Staff submissions list endpoint

**Files:**
- Create: `src/app/api/cash/submissions/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/cash/submissions/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SubmissionListRow = {
  id: string;
  reporting_month: string;
  status: string;
  total_cash_minor: number;
  total_registered: number;
  active_partners: number;
  new_registrations: number;
  lapsed: number;
  submitted_at: string;
  hub_churches: { name: string } | null;
  hubs: { name: string } | null;
  regions: { name: string } | null;
};

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const statusFilter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cash_submissions?select=id,reporting_month,status,total_cash_minor,total_registered,active_partners,new_registrations,lapsed,submitted_at,hub_churches(name),hubs(name),regions(name)&order=submitted_at.desc&limit=500${statusFilter}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }
  const rows = (await res.json()) as SubmissionListRow[];
  return NextResponse.json({ ok: true, submissions: rows });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cash/submissions/route.ts
git commit -m "feat: staff cash submissions list endpoint"
```

---

## Task 9: Promote endpoint — staff action that writes cash rows to payments

**Files:**
- Create: `src/app/api/cash/[id]/promote/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/cash/[id]/promote/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  buildCashPaymentRows,
  getSubmissionForPromote,
  insertCashPayments,
  markSubmissionPromoted,
} from "@/lib/cash/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const data = await getSubmissionForPromote(id);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Submission not found." }, { status: 404 });
  }
  if (data.submission.status === "promoted") {
    return NextResponse.json({ ok: false, error: "Already promoted." }, { status: 409 });
  }

  const paymentRows = buildCashPaymentRows(data.submission, data.givers);
  try {
    await insertCashPayments(paymentRows);
    await markSubmissionPromoted(id);
  } catch (err) {
    console.error("[cash/promote] failed", err);
    return NextResponse.json(
      { ok: false, error: "Promotion failed. Payment rows may be incomplete." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    promoted: paymentRows.length,
    submissionId: id,
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cash/[id]/promote/route.ts
git commit -m "feat: staff cash submission promote endpoint"
```

---

## Task 10: Form UI — server shell + client component

**Files:**
- Create: `src/app/cash/page.tsx`
- Create: `src/app/cash/cash-form.tsx`

- [ ] **Step 1: Write the server shell**

```tsx
// src/app/cash/page.tsx
import { CashForm } from "./cash-form";

export const dynamic = "force-dynamic";

export default function CashPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground">
          Monthly Cash Collection Form
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Report your church&apos;s cash collections for the month. Select your
          region, hub, and church below.
        </p>
        <div className="mt-6">
          <CashForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the client component**

```tsx
// src/app/cash/cash-form.tsx
"use client";

import { useState, useEffect, useCallback } from "react";

type Region = { code: string; name: string };
type Hub = { id: string; label: string };
type Church = { id: string; name: string };
type GiverRow = {
  name: string;
  phone: string;
  amountCedis: string;
  transactionRef: string;
};

const emptyGiver = (): GiverRow => ({ name: "", phone: "", amountCedis: "", transactionRef: "" });

export function CashForm() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [hubId, setHubId] = useState("");
  const [churchId, setChurchId] = useState("");
  const [reportingMonth, setReportingMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [summary, setSummary] = useState({
    totalRegistered: "",
    activePartners: "",
    newRegistrations: "",
    lapsed: "",
  });
  const [givers, setGivers] = useState<GiverRow[]>([emptyGiver()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/cash/regions")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRegions(d.regions);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setHubs([]);
    setHubId("");
    setChurches([]);
    setChurchId("");
    if (!regionCode) return;
    fetch(`/api/cash/hubs?regionCode=${encodeURIComponent(regionCode)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setHubs(d.hubs);
      })
      .catch(() => {});
  }, [regionCode]);

  useEffect(() => {
    setChurches([]);
    setChurchId("");
    if (!hubId) return;
    fetch(`/api/cash/churches?hubId=${encodeURIComponent(hubId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setChurches(d.churches);
      })
      .catch(() => {});
  }, [hubId]);

  const totalGiverAmount = givers.reduce((sum, g) => {
    const v = parseFloat(g.amountCedis);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const addGiver = () => setGivers((prev) => [...prev, emptyGiver()]);
  const removeGiver = (index: number) =>
    setGivers((prev) => prev.filter((_, i) => i !== index));
  const updateGiver = (index: number, field: keyof GiverRow, value: string) =>
    setGivers((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const payload = {
      regionCode,
      hubId,
      churchId,
      reportingMonth,
      summary: {
        totalRegistered: parseInt(summary.totalRegistered) || 0,
        activePartners: parseInt(summary.activePartners) || 0,
        newRegistrations: parseInt(summary.newRegistrations) || 0,
        lapsed: parseInt(summary.lapsed) || 0,
      },
      givers: givers
        .filter((g) => g.name.trim() || g.phone.trim())
        .map((g) => ({
          name: g.name.trim(),
          phone: g.phone.trim(),
          amountMinor: Math.round(parseFloat(g.amountCedis) * 100) || 0,
          transactionRef: g.transactionRef.trim(),
        })),
    };

    try {
      const res = await fetch("/api/cash/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: `Submission received. ID: ${data.submissionId}` });
      } else {
        const msg =
          data.error === "already_submitted"
            ? "A submission for this church and month already exists."
            : data.error ?? "Submission failed.";
        setResult({ ok: false, message: msg });
      }
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Identity */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Church Selection</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
            required
            className="rounded border border-border bg-input px-3 py-2 text-sm"
          >
            <option value="">Select region…</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
          <select
            value={hubId}
            onChange={(e) => setHubId(e.target.value)}
            required
            disabled={!regionCode}
            className="rounded border border-border bg-input px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select hub…</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>{h.label}</option>
            ))}
          </select>
          <select
            value={churchId}
            onChange={(e) => setChurchId(e.target.value)}
            required
            disabled={!hubId}
            className="rounded border border-border bg-input px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select church…</option>
            {churches.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <input
          type="month"
          value={reportingMonth}
          onChange={(e) => setReportingMonth(e.target.value)}
          required
          className="rounded border border-border bg-input px-3 py-2 text-sm"
        />
      </section>

      {/* Section 2: Summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Monthly Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-xs text-muted-foreground">Total Registered</span>
            <input
              type="number"
              min={0}
              value={summary.totalRegistered}
              onChange={(e) => setSummary((s) => ({ ...s, totalRegistered: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Active Partners</span>
            <input
              type="number"
              min={0}
              value={summary.activePartners}
              onChange={(e) => setSummary((s) => ({ ...s, activePartners: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">New Registrations</span>
            <input
              type="number"
              min={0}
              value={summary.newRegistrations}
              onChange={(e) => setSummary((s) => ({ ...s, newRegistrations: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Lapsed</span>
            <input
              type="number"
              min={0}
              value={summary.lapsed}
              onChange={(e) => setSummary((s) => ({ ...s, lapsed: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-input px-2 py-1 text-sm"
            />
          </label>
        </div>
      </section>

      {/* Section 3: Giver list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Cash Givers</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            Total: GHS {totalGiverAmount.toFixed(2)}
          </span>
        </div>
        {givers.map((giver, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              placeholder="Name"
              value={giver.name}
              onChange={(e) => updateGiver(i, "name", e.target.value)}
              className="col-span-4 rounded border border-border bg-input px-2 py-1 text-sm"
            />
            <input
              placeholder="Phone"
              value={giver.phone}
              onChange={(e) => updateGiver(i, "phone", e.target.value)}
              className="col-span-3 rounded border border-border bg-input px-2 py-1 text-sm"
            />
            <input
              placeholder="Amount (GHS)"
              type="number"
              min={0}
              step="0.01"
              value={giver.amountCedis}
              onChange={(e) => updateGiver(i, "amountCedis", e.target.value)}
              className="col-span-2 rounded border border-border bg-input px-2 py-1 text-sm"
            />
            <input
              placeholder="Receipt ref (optional)"
              value={giver.transactionRef}
              onChange={(e) => updateGiver(i, "transactionRef", e.target.value)}
              className="col-span-2 rounded border border-border bg-input px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeGiver(i)}
              disabled={givers.length === 1}
              className="col-span-1 rounded border border-border px-2 py-1 text-sm disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addGiver}
          className="rounded border border-border px-3 py-1 text-sm"
        >
          + Add giver
        </button>
      </section>

      {result && (
        <div
          className={
            result.ok
              ? "rounded bg-green-100 p-3 text-sm text-green-800"
              : "rounded bg-red-100 p-3 text-sm text-red-800"
          }
        >
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !churchId}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Cash Report"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify lint**

Run: `npm run lint`
Expected: PASS (0 errors in cash files; pre-existing warnings in `scripts/` are unrelated).

- [ ] **Step 5: Commit**

```bash
git add src/app/cash/page.tsx src/app/cash/cash-form.tsx
git commit -m "feat: cash payment form UI with cascading dropdowns"
```

---

## Task 11: Docs — update db-schema.md and api-spec.md

**Files:**
- Modify: `docs/db-schema.md`
- Modify: `docs/api-spec.md`

- [ ] **Step 1: Add cash tables to db-schema.md**

Add a new subsection after the `payment_imports`/`payment_import_rows` section, documenting `cash_submissions` and `cash_submission_givers` with their columns, the `unique (church_id, reporting_month)` no-double-count constraint, and the public-insert/staff-read RLS posture (referencing migration 0012's pattern).

- [ ] **Step 2: Add cash routes to api-spec.md**

Add a new section documenting:
- `GET /api/cash/regions`, `GET /api/cash/hubs`, `GET /api/cash/churches` (public, structural data only)
- `POST /api/cash/submit` (public, rate-limited, validation gates, idempotency)
- `GET /api/cash/submissions` (staff)
- `POST /api/cash/:id/promote` (staff, idempotent promotion to `payments`)

- [ ] **Step 3: Commit**

```bash
git add docs/db-schema.md docs/api-spec.md
git commit -m "docs: cash payment form schema and API spec"
```

---

## Task 12: Full verification — tests, typecheck, lint

- [ ] **Step 1: Run all tests**

Run: `npm test -- --run`
Expected: all test files pass, including the new `validation.test.ts` and `rate-limit.test.ts`.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: 0 errors in cash files. Pre-existing warnings in `scripts/build-pastors-directory.ts` are unrelated.

- [ ] **Step 4: Smoke test the form (if dev server available)**

Run: `npm run dev`
Open: `http://localhost:3000/cash`
Verify: region dropdown loads → selecting a region populates hubs → selecting a hub populates churches → form submits (or shows validation errors).

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: verification adjustments for cash form"
```

---

## Task 13: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/cash-payment-form
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create --base main --head feat/cash-payment-form \
  --title "feat: cash payment form (subsystem #1)" \
  --body "## Summary
- Public no-login form at /cash for monthly cash collection reporting
- Cascading region → hub → church dropdowns (public endpoints)
- New cash_submissions + cash_submission_givers tables (public-insert/staff-read RLS, mirrors intake_submissions)
- POST /api/cash/submit with validation gates + rate limit + idempotency (one form per church per month)
- Staff promote route writes cash rows to payments ledger with payment_method='cash'
- No double-counting: unique(church_id, reporting_month) + unique(submission_id, transaction_ref) + on_conflict=reference

## Verification
- npm test --run: all pass
- npm run typecheck: pass
- npm run lint: 0 errors

## Spec
docs/superpowers/specs/2026-10-06-cash-payment-form-design.md"
```