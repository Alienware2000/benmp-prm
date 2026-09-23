# Payment Upload And Reconciliation Design

## Purpose

Build a staff-only upload page for BENMP finance staff to import the two known giving statement formats:

- MoMo CSV: `103307789_YYYY-MM-DD_YYYY-MM-DD.csv` style export.
- Ecobank XLS: legacy Excel statement export with one `ReportSheet` worksheet.

The upload should convert statement rows into payment evidence, match them to partners, create contributions for matched gifts, and show uncertain rows in a review queue.

## Source Formats

### MoMo CSV

The MoMo file format is fixed and can be hardcoded. Important columns:

- `Id`
- `External id`
- `Date`
- `Status`
- `Type`
- `From account`
- `From name`
- `To account`
- `To name`
- `To message`
- `Amount`
- `Balance`

Rules:

- Only successful rows are importable gifts.
- `From` is the primary payer phone source when it contains an MSISDN such as `FRI:233.../MSISDN`; `From account` is the fallback payer identifier.
- `From name` is the secondary payer identifier.
- Currency defaults to `GHS` when the export currency column is blank.
- Store the full raw row as evidence.

### Ecobank XLS

The Ecobank file format is fixed and can be hardcoded. It is a legacy `.xls` workbook with one sheet named `ReportSheet`. Important columns:

- `Account Name`
- `Account`
- `Account Currency`
- `Narration`
- `VALUE_DATE`
- `POSTING_DATE`
- `Running Balance`
- `Credit`
- `Debit`
- `Sr. No.`

Rules:

- Only rows with a `Credit` amount are importable gifts.
- `Debit` rows are not partner gifts and must not create contributions.
- Donor identity is parsed from `Narration`.
- Prefer `VALUE_DATE` as the contribution date; keep `POSTING_DATE` in raw evidence.
- Currency comes from `Account Currency`, normally `GHS`.
- Store the full raw row as evidence.

## Normalized Import Row

Both hardcoded parsers should normalize rows into one internal shape before matching:

```text
source
source_row_id
transaction_date
amount_minor
currency
payer_name
payer_phone_or_account
provider_reference
raw_row
```

`source_row_id` must be stable enough to make re-imports idempotent. For MoMo use `Id` when available. For Ecobank use a deterministic key from account, `Sr. No.`, value date, credit amount, and narration.

## Matching Rules

Auto-match only when the match is safe.

- Exact normalized phone/account match is high confidence and can auto-apply.
- For MoMo, match the payer phone against partner MoMo/WhatsApp fields first. Ghana numbers compare by normalized E.164 and by the last 9 national digits so `024...`, `23324...`, `+23324...`, and `FRI:23324.../MSISDN` all meet.
- Exact normalized full-name match can auto-apply only when it resolves to one unique partner.
- A unique first-name + last-name match can auto-apply when titles and middle names differ.
- Fuzzy name matches go to review.
- Multiple candidate matches go to review.
- No match goes to review.

Name normalization should ignore:

- Titles such as `Apostle`, `Bishop`, `Rev`, `Reverend`, `Pastor`, `Dr`, `Mr`, `Mrs`, `Miss`, `Ms`, `Prof`.
- Case, punctuation, repeated whitespace, and common statement duplication.

Ecobank matching is mainly name-based because the useful donor identity is embedded in `Narration`. The parser should extract a likely donor name from patterns such as `B/O`, `BO`, `IFO`, standing-order text, transfer text, cheque deposit text, and cash-deposit text, but uncertain parses must remain reviewable.

## Review Queue

Rows that are unmatched, ambiguous, or low-confidence should appear in a finance review queue. Staff can:

- Match the row to an existing partner.
- Create a new partner from the row, then match it.
- Dismiss the row if it is not a partner gift.

Every final action should keep the raw statement row for audit and future debugging.

## Contribution Creation

Matched rows create:

- One immutable `payment_events` record for statement evidence.
- One `contributions` record linked to the partner.
- Updated partner giving rollups where the existing data layer supports them.

The contribution should preserve:

- Amount in integer minor units.
- Currency.
- Contribution date.
- Payment method: `mobile_money` for MoMo, `bank_transfer` for Ecobank credits unless a more specific bank category is later needed.
- Provider/source label.
- Raw row evidence.

## Paid/Unpaid Rule

For a selected month, basic paid/unpaid status is derived from contributions:

- `Paid`: the partner has at least one successful contribution dated inside the selected month.
- `Unpaid`: the partner has no successful contribution dated inside the selected month.

The amount does not affect the basic paid/unpaid tick. Amount remains important for totals, reports, high-touch flags, and giving history.

## Error Handling

- Reject invalid amount rows before matching.
- Reject or review rows without a usable date.
- Do not silently drop rows.
- Show counts for imported, auto-matched, review-needed, dismissed, duplicate, and rejected rows.
- Re-importing the same source rows should not create duplicate payment events or duplicate contributions.

## Testing Targets

- MoMo parser maps the known CSV columns into normalized rows.
- MoMo parser defaults blank currency to `GHS`.
- Ecobank parser reads the legacy statement shape and imports only `Credit` rows.
- Debit rows never create contributions.
- Exact phone match auto-matches.
- Unique normalized name match auto-matches.
- Title-only differences still match by normalized name.
- Fuzzy, duplicate, and unmatched names go to review.
- Any successful contribution in a selected month marks the partner as paid for that month.
