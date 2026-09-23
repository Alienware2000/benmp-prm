"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import type {
  GeographyBreakdown,
  MonthlyBreakdown,
} from "@/lib/poc/dashboard-metrics";

function formatGhs(minor: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatUsd(minor: number): string {
  // Approximate: GHS to USD at ~15:1 (configurable later via fx_rates)
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100 / 15);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

type BreakdownKind = "geography" | "month" | null;

export function BreakdownPanel({
  mostRecentMonth,
  cumulative,
  activeTile,
}: {
  mostRecentMonth: {
    month: string;
    amountMinor: number;
    currency: string;
    byGeography: GeographyBreakdown[];
  } | null;
  cumulative: {
    amountMinor: number;
    currency: string;
    byGeography: GeographyBreakdown[];
    byMonth: MonthlyBreakdown[];
  };
  activeTile: "month" | "cumulative";
}) {
  const [breakdownKind, setBreakdownKind] = useState<BreakdownKind>("geography");

  const data =
    activeTile === "month"
      ? mostRecentMonth
      : activeTile === "cumulative"
        ? cumulative
        : null;

  const monthData = activeTile === "cumulative" ? cumulative.byMonth : [];

  if (!data && !monthData.length) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Toggle buttons rendered by parent tiles — this panel only shows when open */}
      {activeTile && data && (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-foreground">
              {activeTile === "month"
                ? `Breakdown — ${mostRecentMonth ? monthLabel(mostRecentMonth.month) : "Most recent month"}`
                : "Cumulative breakdown"}
            </h3>
            {activeTile === "cumulative" && (
              <div className="flex gap-1">
                <button
                  onClick={() => setBreakdownKind("geography")}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    breakdownKind === "geography"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  By geography
                </button>
                <button
                  onClick={() => setBreakdownKind("month")}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    breakdownKind === "month"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  By month
                </button>
              </div>
            )}
          </div>

          {breakdownKind === "geography" || activeTile === "month" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Geography</th>
                  <th className="py-2 pr-4 text-right font-medium">Partners</th>
                  <th className="py-2 pr-4 text-right font-medium">GHS</th>
                  <th className="py-2 text-right font-medium">USD (est.)</th>
                </tr>
              </thead>
              <tbody>
                {data.byGeography
                  .map((g) => (
                    <tr
                      key={g.geography}
                      className="border-b border-border/50"
                    >
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {g.geography}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {g.partnerCount.toLocaleString("en-US")}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                        {formatGhs(g.amountMinor)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {formatUsd(g.amountMinor)}
                      </td>
                    </tr>
                  ))}
                <tr className="font-bold">
                  <td className="py-2 pr-4 text-foreground">Total</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                    {data.byGeography
                      .reduce((s, g) => s + g.partnerCount, 0)
                      .toLocaleString("en-US")}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                    {formatGhs(data.amountMinor)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {formatUsd(data.amountMinor)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            /* Month breakdown for cumulative */
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Month</th>
                  <th className="py-2 text-right font-medium">GHS</th>
                  <th className="py-2 text-right font-medium">USD (est.)</th>
                </tr>
              </thead>
              <tbody>
                {monthData.map((m) => (
                  <tr
                    key={m.month}
                    className="border-b border-border/50"
                  >
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {monthLabel(m.month)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {formatGhs(m.amountMinor)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {formatUsd(m.amountMinor)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 pr-4 text-foreground">Total</td>
                  <td className="py-2 text-right tabular-nums text-foreground">
                    {formatGhs(cumulative.amountMinor)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {formatUsd(cumulative.amountMinor)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/** Clickable metric tile that toggles the breakdown panel. */
export function ClickableMetricTile({
  label,
  value,
  detail,
  Icon,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
  tone: "teal" | "green" | "yellow" | "coral" | "blue";
  onClick: () => void;
  active: boolean;
}) {
  const tones: Record<string, string> = {
    teal: "bg-cyan-50 text-brand ring-cyan-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    yellow: "bg-amber-50 text-amber-700 ring-amber-100",
    coral: "bg-rose-50 text-rose-700 ring-rose-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
  };
  return (
    <button
      onClick={onClick}
      className={`min-w-0 rounded-lg border p-4 text-left shadow-sm transition ${
        active
          ? "border-foreground ring-2 ring-foreground/10"
          : "border-border bg-surface hover:border-foreground/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <span
          className={`grid h-9 w-9 flex-none place-items-center rounded-md ring-1 ${tones[tone]}`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-4 truncate text-2xl font-bold tabular-nums text-foreground sm:text-[26px]">
        {value}
      </p>
      <p className="mt-2 border-t border-border pt-2 text-[11px] leading-5 text-muted-foreground">
        {detail}
      </p>
    </button>
  );
}

import type { DashboardTiles } from "@/lib/poc/dashboard-metrics";
import { CircleDollarSign, TrendingUp, UserCheck, Users } from "lucide-react";

export function DashboardTilesSection({ tiles }: { tiles: DashboardTiles }) {
  const [activeTile, setActiveTile] = useState<"month" | "cumulative" | null>(
    null,
  );

  const monthValue = tiles.mostRecentMonth
    ? `GHS ${formatGhs(tiles.mostRecentMonth.amountMinor)}`
    : "GHS 0";
  const monthDetail = tiles.mostRecentMonth
    ? `${monthLabel(tiles.mostRecentMonth.month)} · click for geography breakdown`
    : "No contributions recorded yet";

  const cumValue = `GHS ${formatGhs(tiles.cumulative.amountMinor)}`;
  const cumDetail =
    tiles.cumulative.amountMinor > 0
      ? "All time · click for breakdown by geography and month"
      : "No contributions recorded yet";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Tile 1: Total BENMP Partners */}
        <ClickableMetricTile
          label="Total BENMP Partners"
          value={tiles.totalPartners.toLocaleString("en-US")}
          detail="In the partner directory"
          Icon={Users}
          tone="teal"
          onClick={() => setActiveTile(null)}
          active={false}
        />
        {/* Tile 2: Active BENMP Partners */}
        <ClickableMetricTile
          label="Active BENMP Partners"
          value={tiles.activePartners.toLocaleString("en-US")}
          detail="Given at least once"
          Icon={UserCheck}
          tone="green"
          onClick={() => setActiveTile(null)}
          active={false}
        />
        {/* Tile 3: Most recent month */}
        <ClickableMetricTile
          label="Amount collected (recent month)"
          value={monthValue}
          detail={monthDetail}
          Icon={CircleDollarSign}
          tone="yellow"
          onClick={() =>
            setActiveTile(activeTile === "month" ? null : "month")
          }
          active={activeTile === "month"}
        />
        {/* Tile 4: Cumulative */}
        <ClickableMetricTile
          label="Total cumulative amount"
          value={cumValue}
          detail={cumDetail}
          Icon={TrendingUp}
          tone="blue"
          onClick={() =>
            setActiveTile(activeTile === "cumulative" ? null : "cumulative")
          }
          active={activeTile === "cumulative"}
        />
      </div>

      {activeTile && (
        <BreakdownPanel
          mostRecentMonth={tiles.mostRecentMonth}
          cumulative={tiles.cumulative}
          activeTile={activeTile}
        />
      )}
    </>
  );
}