"use client";

import { CalendarRange } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Mode = "all" | "latest" | "year" | "custom";

function day(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10);
}

function latestMonthRange(end: string): { from: string; to: string } {
  const parsed = new Date(`${day(end)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return { from: "", to: "" };
  return {
    from: `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-01`,
    to: day(end),
  };
}

function yearRange(end: string): { from: string; to: string } {
  const parsed = new Date(`${day(end)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return { from: "", to: "" };
  return { from: `${parsed.getUTCFullYear()}-01-01`, to: day(end) };
}

export function PeriodFilter({
  availableStart,
  availableEnd,
  currentFrom,
  currentTo,
}: {
  availableStart: string | null;
  availableEnd: string | null;
  currentFrom?: string;
  currentTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const latest = useMemo(
    () => latestMonthRange(availableEnd ?? ""),
    [availableEnd],
  );
  const year = useMemo(() => yearRange(availableEnd ?? ""), [availableEnd]);
  const cleanFrom = day(currentFrom);
  const cleanTo = day(currentTo);
  const inferred: Mode =
    !cleanFrom && !cleanTo
      ? "all"
      : cleanFrom === latest.from && cleanTo === latest.to
        ? "latest"
        : cleanFrom === year.from && cleanTo === year.to
          ? "year"
          : "custom";
  const [mode, setMode] = useState<Mode>(inferred);
  const [from, setFrom] = useState(cleanFrom || day(availableStart));
  const [to, setTo] = useState(cleanTo || day(availableEnd));

  function navigate(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (nextFrom) params.set("from", nextFrom);
    else params.delete("from");
    if (nextTo) params.set("to", nextTo);
    else params.delete("to");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function changeMode(next: Mode) {
    setMode(next);
    if (next === "all") navigate("", "");
    if (next === "latest") navigate(latest.from, latest.to);
    if (next === "year") navigate(year.from, year.to);
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-2 shadow-sm">
      <label className="flex min-w-[210px] items-center gap-2 text-xs font-semibold text-muted-foreground">
        <CalendarRange className="h-4 w-4 flex-none text-brand" aria-hidden />
        <span className="sr-only">Giving period</span>
        <select
          value={mode}
          onChange={(event) => changeMode(event.target.value as Mode)}
          className="h-9 min-w-0 flex-1 bg-transparent pr-2 text-sm font-semibold text-foreground outline-none"
        >
          <option value="all">All available giving</option>
          <option value="latest">Latest recorded month</option>
          <option value="year">Recorded year to date</option>
          <option value="custom">Custom dates</option>
        </select>
      </label>
      {mode === "custom" && (
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-border pt-2">
          <label className="grid gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9 min-w-0 rounded-md border border-border bg-background px-2 text-xs font-normal text-foreground"
            />
          </label>
          <label className="grid gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-9 min-w-0 rounded-md border border-border bg-background px-2 text-xs font-normal text-foreground"
            />
          </label>
          <button
            type="button"
            title="Apply custom dates"
            onClick={() => navigate(from, to)}
            disabled={!from || !to || from > to}
            className="mt-[18px] h-9 rounded-md bg-brand px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
