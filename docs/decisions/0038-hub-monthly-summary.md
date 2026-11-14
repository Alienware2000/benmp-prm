# 0038 — Hubs see their month: all giving, cash, and who has filed

_2026-11-14_

**Decided**: the hub login gets a **Monthly summary** tab (`/hub/summary?month=YYYY-MM`, default the current month). For the chosen month it shows all giving, statement giving (MoMo / bank / Paystack, by method), cash giving and "cash reports filed N of M"; then the hub's churches split into **Cash report filed** (statement giving, cash, date filed) and **Not filed yet**; then a six-month month-by-month table whose months link to their own summary. Statement giving is payments matched to the hub's partners, by the month the money arrived; cash is the churches' cash reports for that reporting month, counted whether or not the office has promoted them. Ledger rows in the cash group are left out of statement giving, so promoted cash is never counted twice. Every read is filtered by the session's hub. Pure logic in `src/lib/hub/monthly.ts` (tested); data from `getHubMonthlyInput` in `src/lib/hub/db.ts`.

**Why**: the office asked that each hub login give "an overview of all giving and cash giving", a breakdown of which churches have submitted and which have not, and a summary the hub admin can see for each month (2026-11-14). The Overview tab (Decision 0032) is about partners' active/lapsed status over a rolling window, not a month, and the per-branch cash view existed only in the office's Admins tab (Decision 0036).

**Said no to**: adding the month to the Overview tab (it answers a different question; both stay) · using only promoted (ledger) cash (a hub would see its own filed report as GHS 0 until the office acts) · per-partner rows here (that's Your partners / Overview).
