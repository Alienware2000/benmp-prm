# Payment Upload Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a staff uploader page for the fixed MoMo CSV and Ecobank XLS formats, match gifts to partners, and write matched gifts into the existing POC `payments` ledger.

**Architecture:** Add pure parser and matcher modules under `src/lib/poc/` with Vitest coverage, then expose them through a `/poc/giving/upload` client page and API route. The API parses the uploaded file, loads partners, auto-matches safe rows, accepts staff review decisions, inserts idempotent rows into `payments`, and revalidates the giving cache.

**Tech Stack:** Next.js App Router route handlers and client components, TypeScript, Vitest, Supabase PostgREST service-role writes, `papaparse`, `exceljs` for CSV/XLSX-compatible parsing, and hardcoded schema parsing for the known statement columns.

---

## File Structure

- Create `src/lib/poc/payment-upload.ts`: pure amount/date/name normalization, MoMo/Ecobank row parsing, donor-name extraction, matching, paid-month helper, and DB row mapping.
- Create `src/lib/poc/payment-upload.test.ts`: unit tests for fixed schemas, matching confidence, title-insensitive names, debit exclusion, and monthly paid/unpaid.
- Create `src/app/api/poc/giving/upload/route.ts`: multipart upload endpoint for preview and commit actions.
- Create `src/app/poc/giving/upload/upload-client.tsx`: client-side upload/review UI.
- Create `src/app/poc/giving/upload/page.tsx`: server page shell for uploader.
- Modify `src/app/poc/workspace-nav.tsx`: add Upload tab.
- Modify `docs/superpowers/specs/2026-09-23-payment-upload-reconciliation-design.md`: keep final implementation notes if behavior differs.

## Tasks

### Task 1: Pure Parser And Matcher

**Files:**
- Create: `src/lib/poc/payment-upload.ts`
- Create: `src/lib/poc/payment-upload.test.ts`

- [ ] Write tests for MoMo parser, Ecobank parser, matching, and paid-month rules.
- [ ] Run `npm test -- src/lib/poc/payment-upload.test.ts` and verify the tests fail because the module does not exist.
- [ ] Implement pure helpers and types in `src/lib/poc/payment-upload.ts`.
- [ ] Run `npm test -- src/lib/poc/payment-upload.test.ts` and verify the tests pass.

### Task 2: Upload API

**Files:**
- Create: `src/app/api/poc/giving/upload/route.ts`
- Modify: `src/lib/poc/payment-upload.ts`

- [ ] Add tests for API-adjacent row mapping in the pure module where possible.
- [ ] Run the targeted tests and verify failures.
- [ ] Implement the route handler with preview and commit actions.
- [ ] Run the targeted tests and typecheck.

### Task 3: Upload Page UI

**Files:**
- Create: `src/app/poc/giving/upload/page.tsx`
- Create: `src/app/poc/giving/upload/upload-client.tsx`
- Modify: `src/app/poc/workspace-nav.tsx`

- [ ] Add a page that lets staff choose MoMo or Ecobank, upload a file, preview auto/review rows, pick existing partner or create a partner for review rows, and commit.
- [ ] Add Upload to the workspace nav.
- [ ] Verify `npm run typecheck` catches no TS errors.

### Task 4: Verification And Commit

**Files:**
- All changed files.

- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test -- src/lib/poc/payment-upload.test.ts`.
- [ ] Inspect `git status`, `git diff`, and `git log --oneline -10`.
- [ ] Stage only uploader-related files and commit with the repo's current git identity, confirming the author is `charlieboye96` if configured.
