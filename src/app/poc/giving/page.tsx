import Link from "next/link";
import {
  CircleDollarSign,
  Filter,
  MessageCircle,
  MessagesSquare,
} from "lucide-react";
import type { GivingEntry } from "@/lib/poc/giving";
import {
  UNATTRIBUTED,
  filterGiving,
  sortByDateDesc,
  summarizeGiving,
} from "@/lib/poc/giving";
import { loadGivingLedgerCached } from "@/lib/poc/cached-data";
import { PocShell } from "../nav";
import { PeriodFilter } from "../period-filter";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  name?: string;
  minAmount?: string;
  maxAmount?: string;
  page?: string;
}>;

function formatDate(iso: string): string {
  if (!iso) return "Not dated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not dated";
  return `${date.getUTCDate()} ${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCFullYear()}`;
}

function ghs(minor: number): string {
  return (minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function amountToMinor(value: string): number | undefined {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

function thankYouHref(entry: GivingEntry): string | null {
  if (entry.isStatement || !entry.phone) return null;
  const params = new URLSearchParams({
    mode: "number",
    template: "thank-you",
    name: entry.name,
    phone: entry.phone,
    amountMinor: String(entry.amountMinor),
  });
  return `/poc/messages?${params.toString()}`;
}

function periodHref(path: string, from: string, to: string): string {
  const [pathname, existingQuery = ""] = path.split("?");
  const params = new URLSearchParams(existingQuery);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
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

const FIELD =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand";
const LABEL =
  "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

function RefinementFields({
  prefix,
  from,
  to,
  name,
  minAmount,
  maxAmount,
}: {
  prefix: string;
  from: string;
  to: string;
  name: string;
  minAmount: string;
  maxAmount: string;
}) {
  return (
    <>
      {from && <input type="hidden" name="from" value={from} />}
      {to && <input type="hidden" name="to" value={to} />}
      <div>
        <label htmlFor={`${prefix}-name`} className={LABEL}>
          Giver name
        </label>
        <input
          id={`${prefix}-name`}
          name="name"
          defaultValue={name}
          placeholder="Search by name"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-min`} className={LABEL}>
          Minimum gift (GHS)
        </label>
        <input
          type="number"
          id={`${prefix}-min`}
          name="minAmount"
          min="0"
          step="0.01"
          inputMode="decimal"
          defaultValue={minAmount}
          placeholder="No minimum"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-max`} className={LABEL}>
          Maximum gift (GHS)
        </label>
        <input
          type="number"
          id={`${prefix}-max`}
          name="maxAmount"
          min="0"
          step="0.01"
          inputMode="decimal"
          defaultValue={maxAmount}
          placeholder="No maximum"
          className={FIELD}
        />
      </div>
    </>
  );
}

export default async function GivingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = {
    from: (sp.from ?? "").slice(0, 10),
    to: (sp.to ?? "").slice(0, 10),
    name: (sp.name ?? "").trim(),
    minAmount: (sp.minAmount ?? "").trim(),
    maxAmount: (sp.maxAmount ?? "").trim(),
  };
  const requestedPage = Math.max(1, Number(sp.page) || 1);
  const ledger = await loadGivingLedgerCached();
  const available = availableDates(ledger);
  const rows = sortByDateDesc(
    filterGiving(ledger, {
      from: filters.from,
      to: filters.to,
      name: filters.name,
      minAmountMinor: amountToMinor(filters.minAmount),
      maxAmountMinor: amountToMinor(filters.maxAmount),
    }),
  );
  const totals = summarizeGiving(rows);
  const ledgerTotal = summarizeGiving(ledger);
  const hasRefinement = Boolean(
    filters.name || filters.minAmount || filters.maxAmount,
  );
  const isFiltered = Boolean(filters.from || filters.to || hasRefinement);
  const averageMinor = totals.count
    ? Math.round(totals.totalMinor / totals.count)
    : 0;
  const highestMinor = rows.reduce(
    (highest, row) => Math.max(highest, row.amountMinor),
    0,
  );
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const firstRecord = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRecord = Math.min(page * pageSize, rows.length);
  const clearRefinements = periodHref("/poc/giving", filters.from, filters.to);
  const thankGroupHref = periodHref(
    "/poc/messages?task=thank",
    filters.from,
    filters.to,
  );
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.name) params.set("name", filters.name);
    if (filters.minAmount) params.set("minAmount", filters.minAmount);
    if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `/poc/giving?${query}` : "/poc/giving";
  };

  return (
    <PocShell
      title="Giving"
      subtitle="Review recorded gifts, filter by amount, and begin an acknowledgement from the verified record."
      toolbar={
        <PeriodFilter
          availableStart={available.start}
          availableEnd={available.end}
          currentFrom={filters.from}
          currentTo={filters.to}
        />
      }
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <article className="col-span-2 rounded-lg bg-brand p-4 text-white shadow-sm sm:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-white/75">
              {isFiltered ? "Selected giving" : "All recorded giving"}
            </p>
            <CircleDollarSign className="h-5 w-5 text-accent" aria-hidden />
          </div>
          <p className="mt-4 text-2xl font-bold tabular-nums">
            {totals.currency} {ghs(totals.totalMinor)}
          </p>
          <p className="mt-2 border-t border-white/15 pt-2 text-[11px] text-white/70">
            {isFiltered
              ? `GHS ${ghs(ledgerTotal.totalMinor)} across all available records`
              : `${totals.givers.toLocaleString("en-US")} identifiable givers`}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Gifts</p>
          <p className="mt-4 text-2xl font-bold tabular-nums">
            {totals.count.toLocaleString("en-US")}
          </p>
          <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
            From {totals.givers.toLocaleString("en-US")} givers
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Average gift
          </p>
          <p className="mt-4 text-2xl font-bold tabular-nums">
            {totals.currency} {ghs(averageMinor)}
          </p>
          <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
            Highest: {totals.currency} {ghs(highestMinor)}
          </p>
        </article>
      </section>

      <section className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-md bg-accent/25 text-brand">
            <MessagesSquare className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-bold">Acknowledge this giving</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Prepare personal thank-you messages using each giver&apos;s
              recorded name and gift amount.
            </p>
          </div>
        </div>
        <Link
          href={thankGroupHref}
          className="inline-flex min-h-10 flex-none items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          <MessagesSquare className="h-4 w-4" aria-hidden />
          Thank selected givers
        </Link>
      </section>

      <details className="mt-4 rounded-lg border border-border bg-surface shadow-sm md:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold">
          <Filter className="h-4 w-4 text-brand" aria-hidden />
          Filter by name or amount
          {hasRefinement && (
            <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand">
              Active
            </span>
          )}
        </summary>
        <form method="GET" className="grid gap-3 border-t border-border p-4">
          <RefinementFields prefix="mobile" {...filters} />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white"
            >
              Apply filters
            </button>
            {hasRefinement ? (
              <Link
                href={clearRefinements}
                className="inline-flex h-10 items-center justify-center rounded-md border border-border text-sm font-semibold"
              >
                Clear
              </Link>
            ) : (
              <span />
            )}
          </div>
        </form>
      </details>

      <form
        method="GET"
        className="mt-4 hidden grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto] items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:grid"
      >
        <RefinementFields prefix="desktop" {...filters} />
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white"
          >
            Apply
          </button>
          {hasRefinement && (
            <Link
              href={clearRefinements}
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-semibold"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mb-3 mt-7 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">
            {isFiltered ? "Matching gifts" : "Gift record"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows.length === 0
              ? "No records shown"
              : `Showing ${firstRecord}-${lastRecord} of ${rows.length.toLocaleString("en-US")}`}
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:hidden">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            No gifts match these filters.
          </p>
        )}
        {visibleRows.map((row) => {
          const messageHref = thankYouHref(row);
          return (
            <article
              key={row.reference}
              className="rounded-lg border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold">{row.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(row.paidAt)}
                    {row.attributed && row.country ? ` · ${row.country}` : ""}
                  </p>
                </div>
                <p className="flex-none text-sm font-bold tabular-nums text-brand">
                  {row.currency} {ghs(row.amountMinor)}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="truncate text-[11px] text-muted-foreground">
                  {row.isStatement
                    ? "Bank transfer record"
                    : row.attributed
                      ? row.branch
                      : UNATTRIBUTED}
                </span>
                {messageHref && (
                  <Link
                    href={messageHref}
                    className="inline-flex h-9 flex-none items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Thank
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden max-h-[540px] overflow-auto rounded-lg border border-border bg-surface md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Date</th>
              <th className="px-2 py-2.5 font-semibold">Giver</th>
              <th className="px-2 py-2.5 font-semibold">Source</th>
              <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-4 py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No gifts match these filters.
                </td>
              </tr>
            )}
            {visibleRows.map((row) => {
              const messageHref = thankYouHref(row);
              return (
                <tr
                  key={row.reference}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                    {formatDate(row.paidAt)}
                  </td>
                  <td className="px-2 py-3 font-medium">{row.name}</td>
                  <td className="px-2 py-3 text-muted-foreground">
                    {row.isStatement
                      ? "Bank transfer"
                      : row.attributed
                        ? [row.branch, row.country].filter(Boolean).join(" · ")
                        : UNATTRIBUTED}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {row.currency} {ghs(row.amountMinor)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {messageHref ? (
                      <Link
                        href={messageHref}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold hover:bg-background"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden />
                        Thank
                      </Link>
                    ) : (
                      <span className="text-muted-foreground/40">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <nav
          aria-label="Giving record pages"
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
