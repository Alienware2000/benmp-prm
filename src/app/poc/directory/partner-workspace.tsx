import Link from "next/link";
import {
  DEFAULT_PAGE_SIZE,
  listBranchGroupsCached,
  loadPartnersByPhones,
  normalizeBranchKey,
  resolveBranchKey,
  searchDirectory,
} from "@/lib/poc/directory";
import {
  buildCallCandidates,
  buildMonthlyCallList,
} from "@/lib/poc/calls";
import { loadGivingLedger } from "@/lib/poc/giving";
import { PocShell } from "../nav";
import { MessagesNav } from "../messages/messages-nav";
import { DirectoryClient } from "./directory-client";

type Audience = "all" | "monthly";

export type PartnerSearchParams = Promise<{
  q?: string;
  branch?: string;
  page?: string;
  audience?: string;
}>;

function audienceHref(
  audience: Audience,
  params: { q: string; branch: string },
): string {
  const qs = new URLSearchParams();
  qs.set("mode", "partners");
  if (audience !== "all") qs.set("audience", audience);
  if (params.q) qs.set("q", params.q);
  if (params.branch) qs.set("branch", params.branch);
  return `/poc/messages?${qs.toString()}`;
}

function PageLink({
  params,
  page,
  children,
  disabled,
}: {
  params: { q: string; branch: string; audience: Audience };
  page: number;
  children: React.ReactNode;
  disabled: boolean;
}) {
  const qs = new URLSearchParams();
  qs.set("mode", "partners");
  if (params.audience !== "all") qs.set("audience", params.audience);
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
  const qLower = q.toLowerCase();
  const branch = (sp.branch ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const audience: Audience = sp.audience === "monthly" ? "monthly" : "all";

  const branches = await listBranchGroupsCached();
  const selected = branches.find((group) => group.key === branch);
  const labelByKey = new Map(branches.map((group) => [group.key, group.label]));

  const result =
    audience === "monthly"
      ? await (async () => {
          const ledger = await loadGivingLedger();
          const shortlist = buildMonthlyCallList(buildCallCandidates(ledger), {
            consistent: true,
            top: true,
            ordinary: true,
          });

          const partnersByPhone = new Map(
            (await loadPartnersByPhones(
              shortlist.map((candidate) => candidate.phone),
            ))
              .filter((partner) => partner.phone !== null)
              .map((partner) => [partner.phone, partner] as const),
          );

          const monthlyRows = shortlist.map((candidate) => {
            const matched = partnersByPhone.get(candidate.phone);
            if (matched) return matched;
            return {
              id: `missing:${candidate.phone}`,
              name: candidate.name,
              phone: candidate.phone,
              branch: candidate.branch,
              country: candidate.country,
              givenMinor: candidate.totalMinor,
              messageable: false,
            };
          });

          const filteredPartners = monthlyRows.filter((partner) => {
            if (qLower && !partner.name.toLowerCase().includes(qLower)) {
              return false;
            }
            if (!branch) return true;
            return resolveBranchKey(normalizeBranchKey(partner.branch)) === branch;
          });

          return {
            partners: filteredPartners,
            total: filteredPartners.length,
            page: 1,
            pageSize: Math.max(filteredPartners.length, 1),
          };
        })()
      : await searchDirectory({
          q,
          branchVariants: selected?.variants,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        });

  const totalPages =
    audience === "monthly"
      ? 1
      : Math.max(1, Math.ceil(result.total / result.pageSize));
  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);
  const filtered = Boolean(q || branch || audience !== "all");

  return (
    <PocShell
      title="Messages"
      subtitle="Choose the people, write the update and review it before sending."
    >
      <MessagesNav current="partners" />

      <div className="mt-3 grid gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2">
        <Link
          href={audienceHref("all", { q: "", branch: "" })}
          className={
            "rounded-md border px-3 py-2 text-left text-sm transition " +
            (audience === "all"
              ? "border-success bg-emerald-50 text-emerald-900"
              : "border-border text-foreground hover:bg-background")
          }
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em]">
            Partner messages
          </span>
          <span className="mt-0.5 block font-medium">All partners</span>
        </Link>
        <Link
          href={audienceHref("monthly", { q: "", branch: "" })}
          className={
            "rounded-md border px-3 py-2 text-left text-sm transition " +
            (audience === "monthly"
              ? "border-success bg-emerald-50 text-emerald-900"
              : "border-border text-foreground hover:bg-background")
          }
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em]">
            Tile 5
          </span>
          <span className="mt-0.5 block font-medium">
            Monthly call shortlist (20 mixed givers)
          </span>
        </Link>
      </div>

      <form
        method="GET"
        className="mt-3 grid gap-2.5 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto] lg:items-end"
      >
        <input type="hidden" name="mode" value="partners" />
        {audience !== "all" && (
          <input type="hidden" name="audience" value={audience} />
        )}
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
        <div className="min-w-0">
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
          className="h-10 rounded-md bg-success px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Search
        </button>
        {filtered && (
          <Link
            href={audienceHref(audience, { q: "", branch: "" })}
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
              labelByKey.get(resolveBranchKey(normalizeBranchKey(partner.branch))) ??
              partner.branch,
          }))}
        />
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <PageLink
            params={{ q, branch, audience }}
            page={page - 1}
            disabled={page <= 1}
          >
            Previous
          </PageLink>
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {page} of {totalPages.toLocaleString("en-US")}
          </span>
          <PageLink
            params={{ q, branch, audience }}
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
