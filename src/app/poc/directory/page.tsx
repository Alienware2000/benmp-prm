import Link from "next/link";
import {
  DEFAULT_PAGE_SIZE,
  listBranchGroups,
  normalizeBranchKey,
  resolveBranchKey,
  searchDirectory,
} from "@/lib/poc/directory";
import { PocShell } from "../nav";
import { DirectoryClient } from "./directory-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; branch?: string; page?: string }>;

function PageLink({
  params,
  page,
  children,
  disabled,
}: {
  params: { q: string; branch: string };
  page: number;
  children: React.ReactNode;
  disabled: boolean;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.branch) qs.set("branch", params.branch);
  if (page > 1) qs.set("page", String(page));
  const cls =
    "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition " +
    (disabled
      ? "pointer-events-none text-muted-foreground/40"
      : "text-foreground hover:bg-background");
  if (disabled) return <span className={cls}>{children}</span>;
  return (
    <Link href={`/poc/directory?${qs.toString()}`} className={cls}>
      {children}
    </Link>
  );
}

export default async function DirectoryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const branch = (sp.branch ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  // `branch` is a canonical key, not a raw value — one branch has many spellings in the
  // data, and the filter must match all of them.
  const branches = await listBranchGroups();
  const selected = branches.find((g) => g.key === branch);
  const result = await searchDirectory({
    q,
    branchVariants: selected?.variants,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const labelByKey = new Map(branches.map((g) => [g.key, g.label]));
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const first = result.total === 0 ? 0 : (page - 1) * result.pageSize + 1;
  const last = Math.min(page * result.pageSize, result.total);
  const filtered = Boolean(q || branch);

  return (
    <PocShell
      current="/poc/directory"
      title="Partner directory"
      subtitle="Search every partner on record, then message the people you pick — nothing sends until you confirm."
    >
      {/* Plain GET form: search and paging work without JavaScript and stay linkable. */}
      <form method="GET" className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-border bg-surface p-4">
        <div className="min-w-[190px] flex-1">
          <label htmlFor="q" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Name
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search partner name…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success"
          />
        </div>
        <div className="min-w-[170px]">
          <label htmlFor="branch" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Branch
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue={branch}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label} ({b.count.toLocaleString("en-US")})
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Search
        </button>
        {filtered && (
          <Link
            href="/poc/directory"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Clear
          </Link>
        )}
      </form>

      <p className="mt-3 text-xs text-muted-foreground">
        {result.total === 0 ? (
          "No partners match those filters."
        ) : (
          <>
            Showing <b className="tabular-nums text-foreground">{first}–{last}</b> of{" "}
            <b className="tabular-nums text-foreground">{result.total.toLocaleString("en-US")}</b> partners
            {filtered ? " matching your filters" : ""}.
          </>
        )}
      </p>

      <div className="mt-3">
        {/* Show the canonical spelling in the table too, so the same branch doesn't read
            as two different places between the filter and the rows. */}
        <DirectoryClient
          partners={result.partners.map((p) => ({
            ...p,
            branch: labelByKey.get(resolveBranchKey(normalizeBranchKey(p.branch))) ?? p.branch,
          }))}
        />
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <PageLink params={{ q, branch }} page={page - 1} disabled={page <= 1}>
            ← Previous
          </PageLink>
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {page} of {totalPages.toLocaleString("en-US")}
          </span>
          <PageLink params={{ q, branch }} page={page + 1} disabled={page >= totalPages}>
            Next →
          </PageLink>
        </div>
      )}
    </PocShell>
  );
}
