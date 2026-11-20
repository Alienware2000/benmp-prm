# 0043 — The Monthly Summary Form drops the giver sheet and transaction IDs

_2026-11-20_

**Decided**: the Monthly Summary Form (`/cash`, Decision 0039) no longer has the **Cash Givers** Excel/CSV upload or the **Cash Transactions** section (transaction ID, channel, amount, date per transfer). Ghana churches (`regions.momo_required`) instead get one optional **Total cash (GHS)** box; it fills `cash_submissions.total_cash_minor`, so the hub and office summaries keep a cash figure. The four numbers and Add New Members are unchanged. Removed: `GET /api/cash/template`, `POST /api/cash/preview`, the `file`/`deposits` parts of `POST /api/cash/submit` (now `cashTotal`), and the sheet parser behind them. New forms write `deposits_total_minor = 0` and no giver file. Past submissions keep their givers, deposits and vaulted sheets (tables untouched), so monitoring, promote-to-ledger and the giver contact CSV (Decision 0041) still show them; new forms add no named cash givers to that CSV.

**Why**: the office (2026-11-20): "take out the transaction ID and cash giving excel". Supersedes the giver-sheet and transaction parts of Decision 0031.

**Said no to**: dropping cash from the form entirely (the hub summaries and the drill-down show a church's cash, and Ghana churches still collect it) · deleting the giver and deposit tables (they hold past forms).
