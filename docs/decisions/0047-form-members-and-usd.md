# 0047 — The form marks every member and reports giving in US dollars

_2026-11-24_

**Decided**: the Monthly Summary Form (`/cash`) gains:

- **Amount given this month (US dollar equivalent)**, required of every church (0 allowed), in place of the Ghana-only cedi total (Decision 0043). Stored as `cash_submissions.given_usd_cents`; the hub Monthly summary and the office Admins tab show it in dollars, for every hub.
- **Members**: once a church is chosen, its members are listed by name (no phone numbers) and each must be marked **Active, New, Lapsed or Remove** before the form submits ("Mark the rest Active" helps on long lists). Choosing another church loads that church's list and clears the marks. Add New Members moves into this section. Marks are kept per form in `cash_submission_members`.
- **Remove is reversible.** A member marked Remove is stamped `removed_at` / `removed_via_submission` and leaves the church's list; nobody is deleted. The hub admin sees them under **Your partners → Removed on the Monthly Summary Form** and can **Restore** them (audited).

The four numbers are still typed by the church, separately from the marks. The form stays public, as the office chose; the member list is names only and its endpoint is rate-limited. Migration `0027_form_members_and_usd.sql`.

**Why**: the office (2026-11-24): "Monthly Summary Form we need to add the amount given for the month"; "Every member should be marked as (Active, New, Lapsed, Remove) on the monthly report form, but in a separate section. This is also the section to add new members"; amount as a "dollar equivalent for every church"; member list "names only, public"; four numbers "keep typing them".

**Said no to**: putting the form behind the hub login or per-church codes (offered; the office chose a public names-only list) · deleting members marked Remove (a public form must not be able to lose people) · computing the four numbers from the marks (the office keeps typing them).
