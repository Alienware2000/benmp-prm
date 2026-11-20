# 0043 — The Monthly Summary Form drops the giver sheet and transaction IDs

_2026-11-20_

**Decided**: the Monthly Summary Form (`/cash`, Decision 0039) no longer has the **Cash Givers** Excel/CSV upload or the **Cash Transactions** section (transaction ID, channel, amount, date per transfer). It is no longer a cash form: it is each church's report of **all its BENMP giving** for the month. Ghana churches (`regions.momo_required`) get one optional **Total giving (GHS)** box (`givingTotal`); it fills `cash_submissions.total_cash_minor` (column name kept, no migration), so the hub and office summaries show the giving each church reported. The four numbers and Add New Members are unchanged. Removed: `GET /api/cash/template`, `POST /api/cash/preview`, the `file`/`deposits` parts of `POST /api/cash/submit` (now `givingTotal`), and the sheet parser behind them. New forms write `deposits_total_minor = 0` and no giver file. Past submissions keep their givers, deposits and vaulted sheets (tables untouched), so monitoring, promote-to-ledger and the giver contact CSV (Decision 0041) still show them; new forms add no named cash givers to that CSV.

**Why**: the office (2026-11-20): "take out the transaction ID and cash giving excel"; "it is no longer cash giving form, it is the report by church of all BENMP giving". Supersedes the giver-sheet and transaction parts of Decision 0031.

**Said no to**: dropping the money figure entirely (the form is how hub giving is tracked) · deleting the giver and deposit tables (they hold past forms).
