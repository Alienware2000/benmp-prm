import Link from "next/link";
import {
  DEFAULT_PAGE_SIZE,
  listBranchGroups,
  normalizeBranchKey,
  resolveBranchKey,
  searchDirectory,
} from "@/lib/poc/directory";
import { PocShell, type PocTab } from "../nav";
import { DirectoryClient } from "./directory-client";

export type PartnerSearchParams = Promise<{
  q?: string;
  branch?: string;
  page?: string;
}>;

type WorkspaceMode = "directory" | "messages";

const WORKSPACE: Record<
  WorkspaceMode,
  { path: PocTab; title: string; subtitle: string }
> = {
  directory: {
    path: "/poc/directory",
    title: "Partner directory",
    subtitle: "Search and review every partner on record.",
  },
  messages: {
    path: "/poc/messages",
    title: "Messages",
    subtitle:
      "Choose partners, personalize the message, preview it, then confirm the send.",
  },
};

function PageLink({
  basePath,
  params,
  page,
  children,
  disabled,
}: {
  basePath: string;
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
    <Link href={`${basePath}?${qs.toString()}`} className={cls}>
      {children}
    </Link>
  );
}

export async function PartnerWorkspace({
  searchParams,
  mode,
}: {
  searchParams: PartnerSearchParams;
  mode: WorkspaceMode;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const branch = (sp.branch ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const workspace = WORKSPACE[mode];

  const branches = await listBranchGroups();
  const selected = branches.find((group) => group.key === branch);
  const result = await searchDirectory({
    q,
    branchVariants: selected?.variants,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const labelByKey = new Map(branches.map((group) => [group.key, group.label]));
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const first = result.total === 0 ? 0 : (page - 1) * result.pageSize + 1;
  const last = Math.min(page * result.pageSize, result.total);
  const filtered = Boolean(q || branch);

  return (
    <PocShell
      current={workspace.path}
      title={workspace.title}
      subtitle={workspace.subtitle}
    >
      <form
        method="GET"
        className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-border bg-surface p-4"
      >
        <div className="min-w-[190px] flex-1">
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
        <div className="min-w-[170px]">
          <label
            htmlFor="branch"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Branch
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue={branch}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success"
          >
            <option value="">All branches</option>
            {branches.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label} ({group.count.toLocaleString("en-US")})
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
            href={workspace.path}
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
          messaging={mode === "messages"}
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
          <PageLink
            basePath={workspace.path}
            params={{ q, branch }}
            page={page - 1}
            disabled={page <= 1}
          >
            Previous
          </PageLink>
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {page} of {totalPages.toLocaleString("en-US")}
          </span>
          <PageLink
            basePath={workspace.path}
            params={{ q, branch }}
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
