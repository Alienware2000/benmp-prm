# Import Now Review Later Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let finance staff commit auto-matched giving immediately while saving unmatched/ambiguous rows for later review.

**Architecture:** Reuse the existing `/api/poc/giving/upload` route and pure matching helpers. Change commit semantics so review rows are persisted as pending review records in a localStorage-backed queue on the client for now, while accepted auto matches are written to the existing `payments` ledger; the UI exposes a separate “Review queue” section after upload.

**Tech Stack:** Next.js App Router, TypeScript, React client state/localStorage, Vitest.

---

## File Structure

- Modify `src/app/poc/giving/upload/upload-client.tsx`: commit auto matches without requiring review decisions; save review rows to localStorage and render a later review queue.
- Modify `src/app/api/poc/giving/upload/route.ts`: make omitted decisions mean “defer review” instead of “dismiss”.
- Modify `src/lib/poc/payment-upload.test.ts`: cover deferred review semantics through pure selection helper if extracted.
- Modify `docs/api-spec.md` and design spec: document import-now/review-later behavior.

## Tasks

### Task 1: Commit Auto Matches Without Blocking

**Files:**
- Modify: `src/app/api/poc/giving/upload/route.ts`
- Modify: `src/app/poc/giving/upload/upload-client.tsx`

- [ ] Change commit so missing decisions count as `deferred`, not dismissed.
- [ ] Change UI copy/buttons from “Commit matched gifts” to “Import safe matches”.
- [ ] On successful commit, store review rows in browser localStorage for later action.

### Task 2: Later Review Queue UI

**Files:**
- Modify: `src/app/poc/giving/upload/upload-client.tsx`

- [ ] Add a “Pending review” section loaded from localStorage.
- [ ] Keep staff actions available: match existing, create new, dismiss.
- [ ] Add a clear/remove action for rows already dealt with.

### Task 3: Verification And PR Update

**Files:**
- Modify: docs and tests as needed.

- [ ] Run targeted tests.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build`.
- [ ] Commit and push to the open PR branch.
