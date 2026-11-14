# 0042 — New decisions and as-built notes are one file each

_2026-11-14_

**Decided**: a new decision is its own file, `docs/decisions/NNNN-slug.md` (next unused number; check the folder and open PRs). A new as-built note is its own file, `docs/as-built/YYYY-MM-DD-slug.md` (date, decision, PR on the line under the title). `decisions.md` keeps the entries up to 0040, and the as-built list in `phases.md` keeps the notes up to Decision 0040. Both point to the folders from their intro paragraphs, away from the entry lines. A PR only adds files there, so two PRs can never edit the same lines.

**Why**: every PR appended its decision to the end of `decisions.md` and put its note at the top of `phases.md`'s as-built list. Any two open PRs therefore conflicted on the same lines. In the 2026-11-14 merges (#109–#112), the hand-resolved conflicts dropped Decision 0038 and the as-built notes of #111 and #112. They were restored inline on #113's branch (commit f51ccde).

**Said no to**: `merge=union` in `.gitattributes` (GitHub's own merge can't be relied on to honour it, so the PR could still show a conflict) · moving the existing entries into files (churn for no benefit; they no longer change) · an index file listing every entry (it would be the next shared line to conflict on; the folder listing is the index).
