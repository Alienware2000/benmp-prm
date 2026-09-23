# DB Backed Payment Import Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store every MoMo/Ecobank upload in `payment_imports` and `payment_import_rows`, promote only safe rows into `payments`, and make review DB-backed instead of browser-local.

**Architecture:** Extend the POC database with compatible `payment_imports` / `payment_import_rows` tables if missing. The upload API creates an import batch, stores all parsed rows with match metadata, inserts safe matches into `payments`, and leaves unresolved rows in `needs_review`. A review endpoint/page reads and resolves those rows later.

**Tech Stack:** Supabase PostgREST service-role API, Next.js route handlers, React App Router pages, TypeScript, Vitest.

---

## File Structure

- Add `supabase/migrations/0014_poc_payment_import_review.sql`: POC-safe import/review tables and indexes.
- Modify `src/app/api/poc/giving/upload/route.ts`: create import batch + rows, promote safe rows, update review row statuses.
- Add `src/app/api/poc/giving/review/route.ts`: list and resolve pending review rows.
- Add `src/app/poc/giving/review/page.tsx` and client component: real review tab.
- Modify `src/app/poc/workspace-nav.tsx`: add Review tab.
- Modify docs/api-spec.md.

## Tasks

### Task 1: Schema

- [ ] Create import/review migration compatible with current Supabase.

### Task 2: Upload API Writes Import Rows

- [ ] On import, insert one `payment_imports` row.
- [ ] Insert one `payment_import_rows` row for every parsed upload row.
- [ ] Promote auto rows to `payments` and mark those rows `promoted`.
- [ ] Mark unresolved rows `needs_review`.

### Task 3: Review API/Page

- [ ] Add endpoint to list `needs_review` rows.
- [ ] Add endpoint to match/create/dismiss review rows and promote resolved rows.
- [ ] Add `/poc/giving/review` tab.

### Task 4: Verify/PR

- [ ] Run tests, typecheck, lint, build.
- [ ] Commit and open/update PR.
