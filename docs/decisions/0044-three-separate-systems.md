# 0044 — MoMo, bank statement and Paystack tracking, hub registrations and hub giving tracking are separate systems

_2026-11-20_

**Decided**: three systems that are **not reconciled** with each other:

1. **MoMo, bank statement and Paystack tracking** (person to person): statement imports (MoMo, bank, Paystack) and giving per name and number. Office only. The month's givers contact CSV (`GET /api/poc/givers?month=`, download form on `/poc/giving`) lists statement givers only (`Name, Phone, Given (GHS), Gifts`), with no hub, church or form data.
2. **Hub registrations**: hubs upload their churches' members (`/hub/upload`, `/hub/partners`, the form's Add New Members); the office messages those registered people.
3. **Hub giving tracking**: the Monthly Summary Form only (the four numbers, and the church's BENMP giving for Ghana; Decision 0043). The hub's Monthly summary and Overview, and the office Admins tab (blocks, hubs, branches: "Forms submitted", "Giving reported"), take every figure from the forms.

Removed: the hub's **Unclaimed givers** tab and `POST /api/hub/claim` (Decision 0033); the church → member-by-month drill-down at `/hub/summary/<churchId>` and `/poc/admins/<region>/<hub>/<church>` (Decision 0040); `GET /api/hub/givers` and the per-hub/per-church giver CSV, including its merge of cash givers from the form (Decision 0041); statement giving on the hub Overview (active / lapsed by gift, Decision 0032) and Monthly summary, and on the office Admins tab. No data is deleted: past claims, `raw_row.matched_partner_id` and form giver rows stay; statement matching is unchanged.

**Why**: the office (2026-11-20): "we now have separate streams, the person to person tracking, using the names and numbers, separate from the messaging of registered givers from the church uploads and then the tracking of the church giving using the form … these are 3 separate systems that do not have to be reconciled"; "we remove the unclaimed givers section entirely, church to members drill down also we remove".

**Said no to**: keeping hub-scoped statement figures "for information" (that is the reconciliation being dropped) · deleting claimed partners' hub links (history; harmless now nothing reads them for giving).
