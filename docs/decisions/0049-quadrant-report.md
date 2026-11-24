# 0049 — A printable report per quadrant for its bishop

_2026-11-24_

**Decided**: each quadrant page on the Admins tab has a **Quadrant report (PDF)** button. It opens `/poc/admins/<region>/report?month=YYYY-MM`, an A4 report of that quadrant for the month:

- the four numbers and the amount given (USD), with how many forms came in;
- the 12-month members chart and finance chart (Decision 0048);
- every hub: admin, forms submitted, the four numbers, given, and a quadrant total;
- optionally (**Add every church**, `&churches=1`) each hub's churches with Submitted / Not submitted and their figures.

**Download PDF** opens the browser's print dialog, where Save as PDF makes the file; staff menus, buttons and chart tooltips are left off the printout. Every figure comes from the Monthly Summary Forms.

**Why**: the office (2026-11-24): "Should be able to create reports for each quadrant to export, for bishops in charge of these"; format "PDF only".

**Said no to**: a server-side PDF library (the browser's own Save as PDF gives the same file with no new dependency) · Excel (the office chose PDF only).
