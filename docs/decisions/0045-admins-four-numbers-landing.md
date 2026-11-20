# 0045 — The office Admins tab opens on the form's four numbers

_2026-11-20_

**Decided**: `/poc/admins` opens on four big values: **Total registered, Active partners, New registrations, Lapsed**, summed from every church's Monthly Summary Form for the chosen month. Each value is a link (`?metric=`) that charts it as columns over the 12 months ending at the chosen month (hover a month for its value and form count; click it to open that month). Below is a **By quadrant** table (the office's nine blocks, Decision 0036: forms submitted, the four numbers, giving reported) to drill down. Each quadrant page (`/poc/admins/<region>`) and hub page (`/poc/admins/<region>/<hub>`) repeats the four values and chart for its own forms; the quadrant page lists its hubs, the hub page its churches with each church's four numbers and giving. A side panel on every Admins page holds a button per quadrant (blocks without hubs are shown greyed) and the **Monthly Summary Form** as a button (opens `/cash`) with **Filed forms** (`/poc/cash/monitoring`); the form tile is gone. Month and metric stay in the address. Every figure comes from the forms (Decision 0044).

**Why**: the office (2026-11-20): "the admin page the landing page should be the 4 big values, that you can click and see the graph and drill down to hub/denominations/countries, and churches underneath"; the earlier list: summary of the four metrics before the quadrants, a column graph of each, buttons on the side for the quadrants, the cash giving form as a button on the side.

**Said no to**: a chart library (one server-rendered SVG chart; no client JavaScript) · all four series on one chart (different scales; one metric at a time) · per-member figures (removed, Decision 0044).
