import Link from "next/link";
import {
  UNATTRIBUTED,
  branchOptions,
  filterGiving,
  loadGivingLedger,
  sortByDateDesc,
  summarizeGiving,
} from "@/lib/poc/giving";
import { PocShell } from "../nav";
import { GivingNav } from "./giving-nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  name?: string;
  branch?: string;
}>;

/** "2026-06-15T09:20:00+00:00" -> "15 Jun 2026" (Ghana is UTC year-round). */
function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}

function ghs(minor: number): string {
  return (minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success";
const LABEL =
  "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export default async function GivingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = {
    from: (sp.from ?? "").trim(),
    to: (sp.to ?? "").trim(),
    name: (sp.name ?? "").trim(),
    branch: (sp.branch ?? "").trim(),
  };

  const ledger = await loadGivingLedger();
  const rows = sortByDateDesc(filterGiving(ledger, filters));
  const totals = summarizeGiving(rows);
  const ledgerTotal = summarizeGiving(ledger);
  const isFiltered = Boolean(
    filters.from || filters.to || filters.name || filters.branch,
  );
  const branches = branchOptions(ledger);
  const unattributed = totals.byBranch.find((b) => b.branch === UNATTRIBUTED);

  return (
    <PocShell
      current="/poc/giving"
      title="Giving"
      subtitle="Every recorded gift. Filter by date, name or branch — the total below always reflects what you're looking at."
    >
      <GivingNav current="ledger" />
      <form
        method="GET"
        className="grid gap-2.5 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div>
          <label htmlFor="from" className={LABEL}>
            From
          </label>
          <input
            type="date"
            id="from"
            name="from"
            defaultValue={filters.from}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="to" className={LABEL}>
            To
          </label>
          <input
            type="date"
            id="to"
            name="to"
            defaultValue={filters.to}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="name" className={LABEL}>
            Name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={filters.name}
            placeholder="Payer name…"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="branch" className={LABEL}>
            Branch
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue={filters.branch}
            className={FIELD}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Apply
          </button>
          {isFiltered && (
            <Link
              href="/poc/giving"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* The headline number: always the total of the filtered set. */}
      <section className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4 sm:col-span-1">
          <p className="text-[13px] font-medium text-muted-foreground">
            {isFiltered ? "Filtered total" : "Total giving"}
          </p>
          <p className="mt-2 text-[27px] font-semibold leading-none tracking-tight tabular-nums">
            {totals.currency} {ghs(totals.totalMinor)}
          </p>
          {isFiltered && (
            <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
              of {ledgerTotal.currency} {ghs(ledgerTotal.totalMinor)} overall
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Gifts</p>
          <p className="mt-2 text-[27px] font-semibold leading-none tracking-tight tabular-nums">
            {totals.count}
          </p>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            from{" "}
            <b className="font-semibold tabular-nums text-foreground">
              {totals.givers}
            </b>{" "}
            givers
            {totals.statementCount > 0 && (
              <> · {totals.statementCount} bank rows</>
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[13px] font-medium text-muted-foreground">
            Branches
          </p>
          <p className="mt-2 text-[27px] font-semibold leading-none tracking-tight tabular-nums">
            {totals.byBranch.filter((b) => b.branch !== UNATTRIBUTED).length}
          </p>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            {unattributed
              ? `${totals.currency} ${ghs(unattributed.amountMinor)} not yet matched to a branch`
              : "all giving matched to a branch"}
          </p>
        </div>
      </section>

      {totals.byBranch.length > 1 && (
        <>
          <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            By branch
          </p>
          <div className="flex flex-wrap gap-2">
            {totals.byBranch.map((b) => (
              <span
                key={b.branch}
                className={
                  "rounded-full border px-3 py-1 text-xs tabular-nums " +
                  (b.branch === UNATTRIBUTED
                    ? "border-border bg-background text-muted-foreground"
                    : "border-emerald-100 bg-emerald-50 text-emerald-800")
                }
              >
                {b.branch} · {totals.currency} {ghs(b.amountMinor)}
              </span>
            ))}
          </div>
        </>
      )}

      <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {isFiltered ? "Matching gifts" : "All gifts"}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Date</th>
              <th className="px-2 py-2.5 font-semibold">Giver</th>
              <th className="px-2 py-2.5 font-semibold">Branch</th>
              <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No gifts match those filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.reference}
                className="border-b border-border/60 last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                  {formatDate(r.paidAt)}
                </td>
                <td className="px-2 py-2.5 font-medium">
                  {r.name}
                  {r.isStatement && (
                    <span className="ml-2 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                      bank transfer
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  {r.attributed ? (
                    <span className="text-muted-foreground">{r.branch}</span>
                  ) : (
                    <span className="text-muted-foreground/60 italic">
                      {r.isStatement ? "not a person" : UNATTRIBUTED}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.currency} {ghs(r.amountMinor)}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-background">
                <td
                  colSpan={3}
                  className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {isFiltered ? "Filtered total" : "Total"}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums">
                  {totals.currency} {ghs(totals.totalMinor)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {unattributed && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">Unattributed</b> means the gift
          isn&apos;t tied to a branch yet — either the payer&apos;s number
          isn&apos;t on a partner record, or the partner it matches has no
          branch set. The money is still counted in every total; assigning those
          partners a branch is what moves it out of this bucket.
        </p>
      )}
    </PocShell>
  );
}
