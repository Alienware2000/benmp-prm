import Link from "next/link";
import {
  DEFAULT_PAGE_SIZE,
  listBranchGroupsCached,
  normalizeBranchKey,
  resolveBranchKey,
  searchDirectory,
} from "@/lib/poc/directory";
import { PocShell } from "../nav";
import { MessagesNav } from "../messages/messages-nav";
import { DirectoryClient } from "./directory-client";

export type PartnerSearchParams = Promise<{
  q?: string;
  page?: string;
  task?: string;
}>;

function PageLink({
  q,
  page,
  children,
  disabled,
}: {
  q: string;
  page: number;
  children: React.ReactNode;
  disabled: boolean;
}) {
  const qs = new URLSearchParams();
  qs.set("task", "update");
  if (q) qs.set("q", q);
  if (page > 1) qs.set("page", String(page));
  const cls =
    "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition " +
    (disabled
      ? "pointer-events-none text-muted-foreground/40"
      : "text-foreground hover:bg-background");
  if (disabled) return <span className={cls}>{children}</span>;
  return (
    <Link href={`/poc/messages?${qs.toString()}`} className={cls}>
      {children}
    </Link>
  );
}

export async function PartnerWorkspace({
  searchParams,
}: {
  searchParams: PartnerSearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const branches = await listBranchGroupsCached();
  const result = await searchDirectory({
    q,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const labelByKey = new Map(branches.map((group) => [group.key, group.label]));
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const first = result.total === 0 ? 0 : (page - 1) * result.pageSize + 1;
  const last = Math.min(page * result.pageSize, result.total);
  const filtered = Boolean(q);

  return (
    <PocShell
      current="/poc/messages"
      title="Messages"
      subtitle="Choose the people, write the update and review it before sending."
    >
      <MessagesNav current="partners" />
      <Link
        href="/poc/messages"
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <span aria-hidden>←</span> Back to message choices
      </Link>
      <form
        method="GET"
        className="grid gap-2.5 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
      >
        <input type="hidden" name="task" value="update" />
        <div className="min-w-0">
          <label
            htmlFor="q"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Name
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search partner name..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-success px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Search
        </button>
        {filtered && (
          <Link
            href="/poc/messages?task=update"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
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
            Showing{" "}
            <b className="tabular-nums text-foreground">
              {first}-{last}
            </b>{" "}
            of{" "}
            <b className="tabular-nums text-foreground">
              {result.total.toLocaleString("en-US")}
            </b>{" "}
            partners{filtered ? " matching your filters" : ""}.
          </>
        )}
      </p>

      <div className="mt-3">
        <DirectoryClient
          messaging
          partners={result.partners.map((partner) => ({
            ...partner,
            branch:
              labelByKey.get(
                resolveBranchKey(normalizeBranchKey(partner.branch)),
              ) ?? partner.branch,
          }))}
        />
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <PageLink q={q} page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {page} of {totalPages.toLocaleString("en-US")}
          </span>
          <PageLink
            q={q}
            page={page + 1}
            disabled={page >= totalPages}
          >
            Next
          </PageLink>
        </div>
      )}
    </PocShell>
  );
}
