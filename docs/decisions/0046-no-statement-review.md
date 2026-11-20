# 0046 — Every statement line goes straight into the ledger; no review queue

_2026-11-20_

**Decided**: a MoMo, bank or Paystack statement import records **every credit line** in `payments` under the payer's name and number from the statement (`payer_name`, `payer_phone_e164`). Linking a line to a partner (exact phone, or a unique full or first+last name) still happens when it can and sets `raw_row.matched_partner_id`, but it is optional: an unlinked line is not held, and no partner is created for it. The **Review** tab (`/poc/giving/review`, `/api/poc/giving/review`), the upload screen's preview and pending-review queue, and the `preview` / `commit` / `commitDeferred` upload actions are removed; `POST /api/poc/giving/upload` has one step. Import rows are all `promoted` (`match_confidence` 0 when unlinked). The giver contacts CSV (Decision 0044) lists linked and unlinked givers alike, by the statement's number (partner's as fallback). The lines already held as `needs_review` are recorded by `scripts/record-held-statement-lines.ts` (dry run by default).

**Why**: the office (2026-11-20): "nothing to review anymore, that assignment and review has been taken out of the architecture". MoMo, bank statement and Paystack tracking is person to person by name and number (Decision 0044), so a line does not need a partner to count.

**Said no to**: creating a partner for every unlinked line (fills the partner list with statement names; the payment already holds the name and number) · keeping dismiss (a credit on the statement is money received).
