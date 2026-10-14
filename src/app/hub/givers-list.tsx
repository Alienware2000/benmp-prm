"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { GivingStatus, HubGivingRow } from "@/lib/hub/giving";

const TABS: { status: GivingStatus; label: string; empty: string }[] = [
  {
    status: "active",
    label: "Active",
    empty: "None of your partners has given in the last three months yet.",
  },
  {
    status: "lapsed",
    label: "Lapsed",
    empty: "No lapsed partners. Everyone who has given is still active.",
  },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** Active / lapsed partners with their last gift date, searchable. */
export function GiversList({ givers }: { givers: HubGivingRow[] }) {
  const [status, setStatus] = useState<GivingStatus>("active");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<GivingStatus, number> = { active: 0, lapsed: 0, never: 0 };
    for (const g of givers) c[g.status] += 1;
    return c;
  }, [givers]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return givers.filter(
      (g) =>
        g.status === status &&
        (!q ||
          [g.fullName, g.phone ?? "", g.church ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [givers, status, query]);

  const tab = TABS.find((t) => t.status === status)!;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.status}
              type="button"
              onClick={() => setStatus(t.status)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-semibold transition " +
                (status === t.status
                  ? "bg-brand/10 text-brand"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label} ({counts[t.status].toLocaleString()})
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, church"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm"
          />
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          {query ? "No one matches that search." : tab.empty}
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="hidden px-3 py-2 sm:table-cell">Church</th>
                <th className="px-3 py-2">Last gift</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <tr key={g.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">
                    {g.fullName}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {g.phone ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                    {g.church ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {g.lastGiftAt ? fmtDate(g.lastGiftAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
