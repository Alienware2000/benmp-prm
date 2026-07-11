# POC — Phased Implementation Plan (Decision 0008)

> The build playbook for the **Ghana + MoMo, Qodesh BENMP proof of concept** — a narrowing of the full MVP, not a new direction (Decision 0008). It **pauses `docs/phases.md`** (the full multi-region plan resumes after the POC proves out). Test-driven: each phase's `VERIFY` gate (`npm run typecheck && npm run lint && npm test && npm run build`) must be green before the next starts. Record deviations as **"As-built notes (POC-N, date)"**. Last updated 2026-07-11.

## POC scope (from Decision 0008)

- **In**: reconcile the provisioned **registration** data against the period's **MoMo payment** data → three buckets → message the right people; a read-only AI that answers "who paid / who didn't / who paid unregistered / totals".
- **Bishop Ebo's rule (load-bearing)**: a payer **not** on the registration sheet is still included and messaged — the payment makes them a partner.
- **Out (deferred to the full MVP)**: GDPR/data-governance build, new-partner registration/sign-up, Supabase multi-region schema + RLS, live payment provider, cron/subscriptions, Claude-on-Vertex.
- **AI model**: **Gemini 2.5** on the fresh Vertex account. **Reminders**: a basic **event-driven** script (due date passed + no recognized payment → message), not a cron.
- **The core is money-safe**: amounts are integer **minor units**, never JS floats.

## What already exists (reuse — do NOT rebuild)

Confirmed by reading the repo (2026-07-11):

- **Reconcile core** — `src/lib/phone.ts`, `src/lib/reconcile.ts` (+ 19 tests). POC-0 done.
- **Messaging** — `src/lib/messaging/`: `MessagingAdapter { send(OutboundMessage) → MessageSendResult }`, a working `MockMessagingAdapter`, and `getMessagingAdapter()` (mock default via `BENMP_MESSAGING_PROVIDER`). **POC-3 reuses this** — it needs a planner + a send loop + opt-out, not a new adapter.
- **AI registry (stub)** — `src/lib/ai/model-registry.ts`: workflow→risk map, `requiresHumanApproval`, `defaultModel = BENMP_DEFAULT_MODEL ?? "gateway:auto"`. **Gemini 2.5 on Vertex is NOT wired** — POC-4 adds the model resolution + the answering; the risk-gating scaffold stays.
- **Frontend** — a staff console already exists: `src/components/dashboard/{shell,header,primitives}.tsx`, `today-workspace.tsx`, and pages `/`, `/giving`, `/ai`, `/partners`, `/reports`, `/communication`, `/follow-up`, `/campaigns`, `/prayer`, `/admin` (mock data). **POC-5 extends this** (a focused view reusing the dashboard primitives + the `/giving` and `/ai` surfaces), not a new UI kit.
- **Data layer** — `src/lib/data/` mock repository behind `PrmRepository`.

Genuinely new for the POC: `src/lib/ingest.ts` (POC-1), `src/lib/messages.ts` (POC-2), `src/lib/poc/answers.ts` + Gemini wiring (POC-4), and one POC route (POC-5).

## Phase summary

| # | Phase | Depends on | State |
|---|---|---|---|
| POC-0 | Reconcile core (phone E.164 + 3-bucket reconcile) | — | **Done** (PR #2) |
| POC-1 | CSV ingestion (registration + payment → typed rows) | POC-0 | Next |
| POC-2 | Message planning (buckets → messages, event-driven reminder) | POC-1 | — |
| POC-3 | Message send (mock adapter, consent/opt-out, structured logs) | POC-2 | — |
| POC-4 | AI answers (Gemini 2.5, read-only, tool logic tested) | POC-1 | with POC-2/3 |
| POC-5 | POC console (upload both CSVs → buckets → send → ask AI) | POC-3, POC-4 | — |
| POC-6 | Real-data dry run & hardening (Qodesh data, as-built notes) | POC-5 | — |

---

## POC-0 — Reconcile core ✅ (Done, PR #2)

**Goal**: the pure heart of the POC — normalize phones and split registration × payment into three buckets.
**Deliverables**: `src/lib/phone.ts` (Ghana-first E.164), `src/lib/reconcile.ts` (`RegistrationRow`/`PaymentRow` → `registeredPaid` / `paidUnregistered` (Bishop Ebo) / `registeredUnpaid`), 19 unit tests.
**Acceptance**: ✅ `npm test` green (19/19); no I/O, no Supabase.

---

## POC-1 — CSV ingestion

**Goal**: turn a raw registration CSV and a raw MoMo payment CSV into the exact `RegistrationRow[]` / `PaymentRow[]` that `reconcile()` consumes — with column mapping, validation, per-row dedup, and money parsed to integer minor units.

**Prereq**: POC-0.

**Deliverables**:
- `src/lib/ingest.ts`:
  - `parseAmountToMinor(raw, decimals=2): number | null` — "120", "120.00", "1,200.50" → minor units; junk → null; **no floats** (string-split on the decimal point).
  - `parseRegistrations(rows: Record<string,string>[], map): { rows: RegistrationRow[]; rejects: {row,reason}[] }`.
  - `parsePayments(rows: Record<string,string>[], map): { rows: PaymentRow[]; rejects; duplicates }` — dedup by `reference`.
  - A `ColumnMap` type per source so the office's real headers are config, not code.
- `papaparse` (already a dep) is used only at the file edge (text → rows); `ingest.ts` takes already-parsed rows so it stays pure and unit-testable.
- `src/lib/ingest.test.ts` — the tests below.

**Acceptance test (`VERIFY`)**:
1. Unit: `parseAmountToMinor` — `"120"→12000`, `"120.00"→12000`, `"1,200.50"→120050`, `"12.5"→1250`, `""/"abc"→null`; a value with 3+ decimals is rejected or truncated deliberately (assert which).
2. Unit: a registration fixture → `RegistrationRow[]` with names/phones preserved; a row missing name/phone → a reject with a reason (nothing dropped silently).
3. Unit: a payment fixture → `PaymentRow[]` with `amountMinor` exact; two rows with the same `reference` → one row + one `duplicates` entry (idempotent).
4. Integration of the two: `reconcile(parseRegistrations(regFix).rows, parsePayments(payFix).rows)` yields the expected three-bucket split, including a paid-but-unregistered payer.
5. Gate: `npm run typecheck && npm run lint && npm test && npm run build` green.

**Constraints**: money is integer minor units end-to-end (never `parseFloat` for the rule); `ingest.ts` does no I/O; phone strings pass through raw (reconcile normalizes).

---

## POC-2 — Message planning

**Goal**: from a `ReconciliationResult`, produce the messages to send — a **thank-you** for `registeredPaid` **and** `paidUnregistered` (Bishop Ebo's rule), and a **reminder** for `registeredUnpaid` whose due date has passed with no recognized payment (the event-driven trigger).

**Prereq**: POC-1.

**Deliverables**:
- `src/lib/messages.ts` (pure): `planMessages(result, { asOf, dueDate, templates }): PlannedMessage[]`. A `PlannedMessage` carries `kind: "thank_you" | "reminder"` and maps cleanly onto the **existing** `OutboundMessage` (`src/lib/messaging/types.ts`: `channel`, `to`, `body`, `category`, `partnerId`) — thank-you → `category:"utility"`, reminder → `category:"utility"`, default `channel:"whatsapp"` for the Ghana POC.
- The reminder is event-driven: only `registeredUnpaid` whose `dueDate < asOf` are targeted.
- `src/lib/messages.test.ts`.

**Acceptance test (`VERIFY`)**:
1. Unit: a paid-unregistered payer gets a `thank_you` (Bishop Ebo's rule holds).
2. Unit: a `registeredUnpaid` partner past `dueDate` gets exactly one `reminder`; before `dueDate` → none.
3. Unit: message bodies personalize name + amount; a payer with no phone is reported as un-sendable, not crashed.
4. Gate green.

---

## POC-3 — Message send (mock adapter)

**Goal**: dispatch planned messages through the existing messaging adapter (mock first), with a consent/opt-out check and structured, greppable logs.

**Prereq**: POC-2. Uses `src/lib/messaging/` (mock adapter).

**Deliverables**: a `sendPlanned(messages)` path over `BENMP_MESSAGING_PROVIDER` (mock default); opt-out list respected; each send logs `{ kind, to, partnerRef, status }`.

**Acceptance test (`VERIFY`)**: Integration — planned messages dispatch through the mock adapter; an opted-out recipient is skipped; a send failure is recorded, not thrown. Gate green.

---

## POC-4 — AI answers (Gemini 2.5, read-only)

**Goal**: answer the POC's headline questions from a `ReconciliationResult` — who paid, who didn't, who paid unregistered, totals — via the AI SDK registry pointed at **Gemini 2.5** on Vertex. **Can run in parallel with POC-2/3.**

**Prereq**: POC-1. Vertex project + Gemini credentials (only to run the model live).

**Deliverables**:
- `src/lib/poc/answers.ts` (pure): aggregation helpers (`countsByBucket`, `totalsMinor`, `unregisteredPayers`) — fully unit-tested, no model.
- `src/lib/ai/model-registry.ts` resolves `gemini-2.5` on Vertex; `/api/ai/chat` (or a POC action) streams answers grounded in those aggregations.

**Acceptance test (`VERIFY`)**:
1. Unit: the aggregation helpers match a hand-computed fixture (this is what the AI cites).
2. Integration (live, creds-gated / skipped without them): "who paid this period?" returns the same count as the helper.
3. Gate green (unit part runs without creds).

**Constraints**: the model only phrases numbers the helpers computed — it never invents figures; every run logged.

---

## POC-5 — POC console

**Goal**: one screen to run the loop: upload the registration CSV + the payment CSV → see the three buckets and totals → send messages → ask the AI.

**Prereq**: POC-3 and POC-4.

**Deliverables**: a focused POC view that **reuses the existing console** — dashboard primitives (`src/components/dashboard/primitives.tsx`) and the `/giving` (imports/reconciliation) and `/ai` surfaces — with two file inputs (papaparse at the edge → `ingest` → `reconcile`), a three-bucket view with totals, a "send messages" action (POC-3), and an "ask" box (POC-4). No new UI kit.

**Acceptance test (`VERIFY`)**: E2E (Playwright) — upload both fixtures → the three buckets render with correct counts/totals → "send" reports per-message status → an AI answer matches the bucket counts. Gate green.

---

## POC-6 — Real-data dry run & hardening

**Goal**: run the whole loop against the **provisioned Qodesh registration + MoMo data**, confirm the numbers with the office, and record what the real files actually looked like.

**Prereq**: POC-5. The office's real registration export + a real MoMo statement/CSV (kept **out of git**).

**Deliverables**: config-driven column mappings matched to the real headers; measured counts; **As-built notes (POC-6, date)** capturing surprises (header quirks, phone shapes, duplicate patterns, unregistered-payer share).

**Acceptance test (`VERIFY`)**: the reconcile totals reconcile against the office's own figures; unregistered payers are visible and messaged (Bishop Ebo's rule); no real data committed. Gate green.

---

## Appendix — learnings from the `benmp-app` prototype (`iCanTutoring/benmp-app`)

Reviewed 2026-07-11. The office prototype already ran the core loop on real Ghana/MoMo data; mine it, don't re-derive it.

**Real registration data** (`lib/contributors.ts`, auto-generated from *Kotobabi Hub BENMP Data.xlsx*): ~117 rows of `{ name, phone (9-digit Ghana NSN), pledged (GHS) }`. This maps to `RegistrationRow { id, fullName, phone, expectedAmountMinor }`.

**Real payment shape** (`donations` table + the MoMo SMS): `amount numeric(14,2)` GHS, `reference` = the MoMo **Transaction ID** (the idempotency key — matches `PaymentRow.reference`), `donor_name`, phone inside `raw_payload.customer.phone_number`, `received_at`. Real MTN SMS: `"Payment received for GHS 50.00 from KWAME MENSAH KWAME MENSAH … Transaction ID: 84850872999."`

**Data quirks POC-1 ingestion MUST tolerate (seen in the real data):**
- MTN **doubles the sender name** ("KWAME MENSAH KWAME MENSAH") — collapse it.
- Some phones are **malformed 8-digit** (`55616029`, `54700087`) — reject or flag, don't crash.
- **Shared/duplicate phones** across people, and **fully duplicated rows** (e.g. "Saviour Doe" twice) — dedup rows; a shared phone means phone match can be ambiguous.
- Names carry **titles** (`Rev.`, `LP.`, `Dr.`, `Ps`) — strip for greeting, keep for the record.
- Amounts are **GHS decimals** (`50.0`, `120.00`) — parse to integer **minor units** (our rule; the prototype kept floats — do not copy that).
- Only **"payment received"** MoMo texts are money; cash-out / fee / airtime texts are not (see `lib/momo-sms.ts`).

**Reusable for POC-2 (adapt the wording):** `thankYouMessage` / `vipMessage` / `reminderMessage` with `firstName()` title-stripping, and the **VIP threshold = 100 GHS** (the prototype's high-touch tier).

**Matching note:** the prototype matched **phone OR name**; our `reconcile.ts` is **phone-only**, with Bishop Ebo's rule catching phone-unmatched payers as `paidUnregistered`. A **name fallback** would reduce false "unregistered" for payers whose MoMo phone differs from the sheet — a candidate enhancement to raise with the office (don't change the rule silently).

### Real POC data files (inspected 2026-07-11, live in `Data/` outside the repo)

The two files the POC actually ingests. Column names below are schema, not PII; **no real names/phones/amounts are recorded here or committed** (see PII boundary).

**Registration — `Qodesh Benmp Members.xlsx`, sheet `Sheet1`, ~900+ members**
- Row 1 is **blank**; the header row is **row 2**: `no.` · `Name ` *(note the trailing space)* · `Phone number`.
- Data: `no.` (1..N) · full name · 9-digit Ghana NSN (e.g. `502669227`).
- **No pledge/expected-amount column** — registration is name + phone only.
- It is an **`.xlsx`**, not a CSV: the edge reader (POC-5) reads the sheet (e.g. SheetJS), **skips the blank first row**, and maps `{ id: "no.", fullName: "Name ", phone: "Phone number" }`; `expectedAmount` is **unset**.

**Payment — `QODESH MOMO.csv`, a MoMo merchant statement (credits into "QODESH CITY CHURCH LBG", account `FRI:109469325/MM`)**
- Columns used (all uniquely named): `Id`→`reference` · `Date` (`YYYY-MM-DD HH:MM:SS`)→`paidAt` · `From name`→`payerName` · `Amount` (whole GHS, e.g. `50`)→`amount` · plus `Status` and `From`/`To` for filtering/extraction.
- **Payer phone is embedded**: `From = "FRI:233244285942/MSISDN"` → strip `FRI:` … `/MSISDN` → `233244285942` (normalizePhone handles it). `From account`/`To account` are `/MM` wallet ids, not phones.
- **Header has duplicate names** (`Currency` ×many, `Initiated by` ×2, `On behalf of` ×2) → parse **index-aware**, not naive header-keyed. The columns we need are unique, so a targeted map is safe.
- Needs a **QODESH pre-transform** before the generic `parsePayments` (POC-5/6): keep `Status = "Successful"` and **incoming** rows (`To account` = the church), extract the phone from `From`, then map `Id`/`From name`/`Amount`/`Date`. Amounts here are whole GHS; `parseAmountToMinor` already handles them.

**Plan deltas from these real files:**
- Registration has **no pledge amount** → `expectedAmountMinor` stays null; POC-2 reminders are purely **event-driven** (no per-partner amount to quote) — consistent with Decision 0008.
- POC-1's generic `ingest.ts` is unchanged and correct; the xlsx read + the QODESH payment pre-transform are **edge adapters** added at POC-5/6, keeping `ingest`/`reconcile` pure.

> **PII boundary:** the prototype committed real names/phones (`contributors.ts`) — **we will NOT** copy that, nor the `Data/` files, into this repo (AGENTS.md / NFR-3: real partner data stays out of git). POC fixtures are **synthetic** but deliberately reproduce the quirks above. The real Qodesh files are read locally at run time (POC-5/6), never committed.

## Cross-phase rules (POC)

- **Money is integer minor units**; never `parseFloat` an amount for a decision.
- **Bishop Ebo's rule is invariant**: a payer is never dropped for being unregistered.
- **Reminders are event-driven** (due date passed + no recognized payment), never a cron.
- **Nothing silently dropped**: invalid/duplicate rows surface as rejects/duplicates.
- **Real registration/payment data stays out of git** (Decision 0008 skips the GDPR build, not basic data hygiene).
- **A phase is done only when its `VERIFY` gate is green** — write the test first, watch it fail, then implement.
