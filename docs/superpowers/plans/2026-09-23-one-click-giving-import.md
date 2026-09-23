# One Click Giving Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace preview-first giving upload with one-click import for both MoMo and Ecobank: upload file, immediately insert safe matches, and defer only unresolved rows to review.

**Architecture:** Keep the existing parser/matcher and upload API. Add an `import` action that parses the file, auto-commits safe matches, returns review rows in the response, and never requires a separate preview click.

**Tech Stack:** Next.js App Router route handler, React client upload form, TypeScript, Vitest.

---

## File Structure

- Modify `src/app/api/poc/giving/upload/route.ts`: add/alias one-click `import` action.
- Modify `src/app/poc/giving/upload/upload-client.tsx`: replace preview workflow with a single `Upload and import` button for MoMo and Ecobank.
- Modify `docs/api-spec.md`: document one-click import.

## Tasks

### Task 1: API One-Click Import

**Files:**
- Modify: `src/app/api/poc/giving/upload/route.ts`

- [ ] Add an `import` action that parses the file, auto-commits `status === "auto"` rows, defers review rows, and returns the same counts plus review rows.

### Task 2: UI One-Click Import

**Files:**
- Modify: `src/app/poc/giving/upload/upload-client.tsx`

- [ ] Replace “Preview upload” and “Import safe matches” two-step copy with one `Upload and import` button.
- [ ] On success, save returned review rows to the pending review queue.
- [ ] Keep MoMo and Ecobank selectable in the same form.

### Task 3: Verify And PR

**Files:**
- Modify: tests/docs as needed.

- [ ] Run targeted tests, typecheck, lint, build.
- [ ] Commit and push a PR.
