# 0041 — Download a month's givers as a contact CSV for broadcasts

_2026-11-14_

**Decided**: a **Download <Month> givers (CSV)** button sits beside the month picker on the hub's Monthly summary (whole hub) and church page, and on the office's hub and church pages. It downloads everyone who gave in that month: members with statement giving (MoMo, bank, Paystack) matched to them, plus the cash givers listed on the month's Monthly Summary Forms, merged by phone so a person appears once. Columns: **Name, Phone (E.164), Church, Given (GHS), Gave by** (Statement / Cash / Statement and cash); sorted by church then name; UTF-8 with a byte-order mark so Excel shows accented names. Names and churches starting with `= + - @` are prefixed with `'` so a spreadsheet cannot run them as formulas (they partly come from a public form); the phone keeps its `+`. Routes: `GET /api/hub/givers` (the session's own hub only) and `GET /api/poc/givers` (staff). A church outside the hub is refused (404) on both. Every download is written to `audit_log` (`giver_contacts_export`: who — hub or office — hub, church, month, contact count) and logged.

**Why**: the office (2026-11-14): "a button to download the names and numbers of those who have given for a given month as a csv of contacts so we can send them a broadcast".

**Said no to**: sending the broadcast from here (the existing Messages tab and the office's broadcast tools do that; this is the list) · leaving out people without a phone (the list should be complete; broadcast tools skip blanks) · dropping the `+` to stop Excel showing long numbers in scientific form (broadcast tools need E.164).
