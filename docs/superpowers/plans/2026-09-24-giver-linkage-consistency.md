# Giver Linkage Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every payment-created giver is persisted with a phone/link to a partner and all dashboard/reconciliation counts use the same persisted linkage.

**Architecture:** Payment import partner creation stores the payer phone in `momo_phone_number`; reconciliation treats `raw_row.matched_partner_id` as the authoritative link, while retaining phone matching for legacy rows. A Supabase migration backfills missing partner phone numbers from their linked payments without overwriting existing contact data.

**Tech Stack:** Next.js App Router, TypeScript, Supabase PostgREST, SQL migrations, Vitest.

---

### Task 1: Add failing tests for persisted payment-to-partner linkage

**Files:**
- Modify: `src/lib/reconcile.ts`
- Test: `src/lib/reconcile.test.ts`
- Test: `src/app/api/poc/giving/upload/route.test.ts` (if present; otherwise add the focused helper test beside existing upload tests)

- [ ] **Step 1: Write a reconciliation test**

Add a payment fixture with `matchedPartnerId` set but a payer phone that is absent from the registration phone map. Assert it is returned in `registeredPaid`, not `paidUnregistered`.

- [ ] **Step 2: Run the focused test and verify RED**

Run `npx vitest run src/lib/reconcile.test.ts -t "uses persisted matched partner linkage"`.
Expected: FAIL because `PaymentRow` and `reconcile` currently only match by phone.

- [ ] **Step 3: Write the partner-creation test**

Exercise the payment import partner creation path with a payer name and E.164 phone and assert the POST payload contains `momo_phone_number` with that phone.

- [ ] **Step 4: Run the focused test and verify RED**

Run the focused upload route test. Expected: FAIL because `createPartner` currently accepts only a name and sends no phone.

### Task 2: Make payment-created partners carry their phone

**Files:**
- Modify: `src/app/api/poc/giving/upload/route.ts`
- Modify: `src/app/api/poc/giving/review/route.ts`
- Modify: `src/lib/poc/payment-upload.ts` only if the current caller contract requires a phone field

- [ ] **Step 1: Change both `createPartner` helpers to accept `(name, phone)`**

Trim the name, preserve a nullable phone, and include `momo_phone_number: phone || null` in the insert payload. Pass `row.payerPhone` at every create call. Do not infer WhatsApp consent from a MoMo phone.

- [ ] **Step 2: Run the partner-creation test**

Expected: PASS.

### Task 3: Make reconciliation use persisted linkage

**Files:**
- Modify: `src/lib/reconcile.ts`
- Modify: `src/lib/poc/db.ts`
- Modify: `src/lib/poc/db.test.ts`

- [ ] **Step 1: Extend `PaymentRow` with `matchedPartnerId?: string | null`**

Map `raw_row->>matched_partner_id` from the payments query into that field.

- [ ] **Step 2: Match by `matchedPartnerId` before phone**

Build a registration map by ID and resolve the persisted link first. Fall back to normalized phone for legacy payments. Preserve statement-artifact handling only when neither persisted linkage nor phone matching identifies a partner.

- [ ] **Step 3: Run reconciliation tests**

Run `npx vitest run src/lib/reconcile.test.ts src/lib/poc/db.test.ts`. Expected: PASS.

### Task 4: Backfill existing payment-created partner phones

**Files:**
- Create: `supabase/migrations/0017_backfill_payment_partner_phones.sql`
- Modify: `docs/db-schema.md` only if the migration changes the documented contract

- [ ] **Step 1: Add an idempotent SQL migration**

Update only partners with both contact columns null, using the first non-null `payments.payer_phone_e164` whose `raw_row->>'matched_partner_id'` equals `partners.id`. Never overwrite existing `momo_phone_number` or `whatsapp_number`; never create duplicate partners.

- [ ] **Step 2: Review the SQL for safe reruns**

The `UPDATE` must be repeatable and must not modify rows that already have either phone field populated.

### Task 5: Align dashboard active counts with persisted partner linkage

**Files:**
- Modify: `src/lib/poc/dashboard-metrics.ts`
- Modify: `src/lib/poc/dashboard-metrics.test.ts`

- [ ] **Step 1: Add a regression fixture**

Cover a payment with `raw_row.matched_partner_id` and no usable phone, and assert it contributes to active partner counts.

- [ ] **Step 2: Use the same linked-partner identity as reconciliation**

Count distinct `matched_partner_id` values for active month/year, falling back to payer phone only for legacy payments without a persisted link. Keep the existing dynamic month label and amount-only value.

- [ ] **Step 3: Run the focused dashboard tests**

Run `npx vitest run src/lib/poc/dashboard-metrics.test.ts`.

### Task 6: Verify end to end

- [ ] **Step 1: Run targeted tests and live smoke check**

Run the reconciliation, upload, and dashboard tests. Run the live dashboard metrics smoke script and confirm the active count uses one identity rule.

- [ ] **Step 2: Run required project checks**

Run `npm run typecheck`, `npm run lint`, and `npx vitest run`.

- [ ] **Step 3: Commit only implementation files**

Do not stage unrelated untracked user files. Commit the linkage fix and migration separately from unrelated work if the branch contains any unrelated changes.
