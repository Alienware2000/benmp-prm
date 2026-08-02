import { PhoneCall } from "lucide-react";
import Link from "next/link";
import {
  buildCallCandidates,
  filterCallCandidates,
  type CallReason,
} from "@/lib/poc/calls";
import { loadGivingLedgerCached } from "@/lib/poc/cached-data";
import { filterGiving, type GivingEntry } from "@/lib/poc/giving";
import { PocShell } from "../nav";
import { PeriodFilter } from "../period-filter";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  filtered?: string;
  consistent?: string;
  top?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

function ghs(currency: string, minor: number): string {
  return `${currency} ${(minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function availableDates(entries: GivingEntry[]): {
  start: string | null;
  end: string | null;
} {
  const dates = entries
    .map((entry) => entry.paidAt.slice(0, 10))
    .filter(Boolean)
    .sort();
  return { start: dates[0] ?? null, end: dates.at(-1) ?? null };
}

const REASON_LABEL: Record<CallReason, string> = {
  consistent: "Repeat giver",
  top: "Top giver",
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const wasSubmitted = sp.filtered === "1";
  const consistent = wasSubmitted ? sp.consistent === "1" : true;
  const top = wasSubmitted ? sp.top === "1" : true;
  const from = (sp.from ?? "").slice(0, 10);
  const to = (sp.to ?? "").slice(0, 10);
  const requestedPage = Math.max(1, Number(sp.page) || 1);

  const completeLedger = await loadGivingLedgerCached();
  const available = availableDates(completeLedger);
  const ledger = filterGiving(completeLedger, { from, to });
  const candidates = buildCallCandidates(ledger);
  const rows = filterCallCandidates(candidates, { consistent, top });
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const firstRecord = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRecord = Math.min(page * pageSize, rows.length);
  const pageHref = (target: number) => {
    const params = new URLSearchParams({ filtered: "1" });
    if (consistent) params.set("consistent", "1");
    if (top) params.set("top", "1");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (target > 1) params.set("page", String(target));
    return `/poc/calls?${params.toString()}`;
  };

  return (
    <PocShell
      title="Calls"
      subtitle="A focused list of repeat and top givers who may benefit from a personal call."
      toolbar={
        <PeriodFilter
          availableStart={available.start}
          availableEnd={available.end}
          currentFrom={from}
          currentTo={to}
        />
      }
    >
      <form
        method="GET"
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <input type="hidden" name="filtered" value="1" />
        {from && <input type="hidden" name="from" value={from} />}
        {to && <input type="hidden" name="to" value={to} />}
        <p className="text-xs font-semibold text-muted-foreground sm:mr-2">
          Show people who are
        </p>
        <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="consistent"
            value="1"
            defaultChecked={consistent}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          Repeat givers
        </label>
        <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="top"
            value="1"
            defaultChecked={top}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          Top givers
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white sm:ml-auto"
        >
          Update list
        </button>
      </form>

      <div className="mb-3 mt-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Call list</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows.length === 0
              ? "No people"
              : `Showing ${firstRecord}-${lastRecord} of ${rows.length.toLocaleString("en-US")}`}
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:hidden">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            No one matches the selected groups.
          </p>
        )}
        {visibleRows.map((row) => (
          <article
            key={row.phone}
            className="rounded-lg border border-border bg-surface p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold">{row.name}</h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {[row.country, row.branch].filter(Boolean).join(" · ")}
                </p>
              </div>
              <a
                href={`tel:${row.phone}`}
                title={`Call ${row.name}`}
                aria-label={`Call ${row.name}`}
                className="grid h-10 w-10 flex-none place-items-center rounded-md bg-brand text-white"
              >
                <PhoneCall className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
              <div>
                <span className="block text-muted-foreground">Giving</span>
                <b className="mt-1 block tabular-nums">
                  {ghs(row.currency, row.totalMinor)}
                </b>
              </div>
              <div>
                <span className="block text-muted-foreground">Gifts</span>
                <b className="mt-1 block tabular-nums">{row.giftCount}</b>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {row.reasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand"
                >
                  {REASON_LABEL[reason]}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Partner</th>
              <th className="px-2 py-3 font-semibold">WhatsApp</th>
              <th className="px-2 py-3 text-right font-semibold">Gifts</th>
              <th className="px-2 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="w-16 px-4 py-3" aria-label="Call" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No one matches the selected groups.
                </td>
              </tr>
            )}
            {visibleRows.map((row) => (
              <tr
                key={row.phone}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-4 py-3">
                  <b className="block font-semibold">{row.name}</b>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[row.country, row.branch].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-3 tabular-nums text-muted-foreground">
                  {row.phone}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">
                  {row.giftCount}
                </td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums">
                  {ghs(row.currency, row.totalMinor)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {row.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand"
                      >
                        {REASON_LABEL[reason]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`tel:${row.phone}`}
                    title={`Call ${row.name}`}
                    aria-label={`Call ${row.name}`}
                    className="inline-grid h-9 w-9 place-items-center rounded-md border border-border text-brand hover:bg-background"
                  >
                    <PhoneCall className="h-4 w-4" aria-hidden />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <nav
          aria-label="Call list pages"
          className="mt-4 flex items-center justify-between gap-3"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold"
            >
              Previous
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-md border border-border px-3 text-sm text-muted-foreground/40">
              Previous
            </span>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold"
            >
              Next
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-md border border-border px-3 text-sm text-muted-foreground/40">
              Next
            </span>
          )}
        </nav>
      )}
    </PocShell>
  );
}
