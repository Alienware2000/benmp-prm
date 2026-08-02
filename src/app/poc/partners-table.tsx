"use client";

import { useState } from "react";

export type PartnerRow = {
  name: string;
  phoneMasked: string;
  status: "registered" | "new";
  amountGhs: string;
  giftCount: number;
  /** Latest payment moment, pre-formatted ("5 Jul, 7:48 PM"). */
  when: string;
};

export type TableData = {
  top: PartnerRow[];
  consistent: PartnerRow[];
  ordinary: PartnerRow[];
};

const TABS = [
  { key: "top", label: "Top", title: "Top givers" },
  {
    key: "consistent",
    label: "Repeat",
    title: "Repeat givers",
  },
  {
    key: "ordinary",
    label: "Ordinary",
    title: "Ordinary givers",
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PartnersTable({ data }: { data: TableData }) {
  const [tab, setTab] = useState<TabKey>("top");
  const active = TABS.find((t) => t.key === tab)!;
  const rows = data[tab];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="grid gap-3 border-b border-border px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {active.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Showing up to 20 people · each giver appears in one category
          </p>
        </div>
        <div
          className="grid grid-cols-3 rounded-lg border border-border bg-background p-0.5 sm:flex"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={
                "min-w-0 rounded-md px-2 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs " +
                (tab === t.key
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[430px] overflow-y-auto">
        <div className="divide-y divide-border md:hidden">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Nothing in this group for the selected giving period.
            </p>
          ) : (
            rows.map((row, index) => (
              <div
                key={`${row.name}-mobile-${index}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {row.name}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {row.phoneMasked} · {row.giftCount}{" "}
                    {row.giftCount === 1 ? "gift" : "gifts"} · {row.when}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {row.amountGhs}
                  </p>
                  <span
                    className={
                      "mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold " +
                      (row.status === "new"
                        ? "bg-accent/25 text-accent-foreground"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {row.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <table className="hidden w-full min-w-[600px] text-sm md:table">
          <thead>
            <tr className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              <th className="px-4 pb-2 pt-3 sm:px-5">Partner</th>
              <th className="pb-2 pt-3 pr-4">Phone</th>
              <th className="pb-2 pt-3 pr-4">Status</th>
              <th className="pb-2 pt-3 pr-4 text-right">Gifts</th>
              <th className="hidden pb-2 pt-3 pr-4 sm:table-cell">When</th>
              <th className="pb-2 pt-3 pr-4 text-right sm:pr-5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border-t border-border px-4 py-6 text-sm text-muted-foreground sm:px-5"
                >
                  Nothing in this group for the selected giving period.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={`${r.name}-${i}`}
                  className="border-t border-border hover:bg-background/60"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground sm:px-5">
                    {r.name}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                    {r.phoneMasked}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={
                        "rounded-md px-2 py-0.5 text-[11px] font-semibold " +
                        (r.status === "new"
                          ? "bg-success/10 text-success"
                          : "bg-background text-muted-foreground")
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {r.giftCount}
                  </td>
                  <td className="hidden whitespace-nowrap py-2.5 pr-4 text-xs tabular-nums text-muted-foreground sm:table-cell">
                    {r.when}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs tabular-nums text-foreground sm:pr-5">
                    {r.amountGhs}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
