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
  tone: "teal" | "green" | "yellow" | "coral" | "blue" | "purple";
  onClick: () => void;
  active: boolean;
}) {
  const tones: Record<string, string> = {
    teal: "text-white bg-[radial-gradient(circle_at_88%_20%,rgba(255,255,255,.17),transparent_24%),linear-gradient(135deg,#078f84_0%,#087477_100%)] ring-transparent",
    green: "text-[#073b4c] bg-[radial-gradient(circle_at_88%_18%,rgba(255,255,255,.65),transparent_25%),linear-gradient(135deg,#c9f6dc_0%,#b7edff_100%)] ring-[#a8e8d2]",
    yellow: "text-[#17344a] bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.55),transparent_28%),linear-gradient(135deg,#fff0bd_0%,#ffd477_100%)] ring-[#f4d17b]",
    purple: "text-[#302064] bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.62),transparent_28%),linear-gradient(135deg,#e8ddff_0%,#d8c7ff_100%)] ring-[#d3c2fa]",
    blue: "text-[#073b4c] bg-[radial-gradient(circle_at_88%_18%,rgba(255,255,255,.65),transparent_25%),linear-gradient(135deg,#b7edff_0%,#a9d5ff_100%)] ring-[#a9d3f3]",
    coral: "text-[#073b4c] bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.62),transparent_28%),linear-gradient(135deg,#ffeaf2_0%,#ffd6e5_100%)] ring-[#f4c6d7]",
  };
  const tileBg: Record<string, string> = {
    teal: "bg-[radial-gradient(circle_at_88%_20%,rgba(255,255,255,.17),transparent_24%),linear-gradient(135deg,#078f84_0%,#087477_100%)]",
    green: "bg-[radial-gradient(circle_at_88%_18%,rgba(255,255,255,.65),transparent_25%),linear-gradient(135deg,#c9f6dc_0%,#b7edff_100%)]",
    yellow: "bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.55),transparent_28%),linear-gradient(135deg,#fff0bd_0%,#ffd477_100%)]",
    purple: "bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.62),transparent_28%),linear-gradient(135deg,#e8ddff_0%,#d8c7ff_100%)]",
    blue: "bg-[radial-gradient(circle_at_88%_18%,rgba(255,255,255,.65),transparent_25%),linear-gradient(135deg,#b7edff_0%,#a9d5ff_100%)]",
    coral: "bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.62),transparent_28%),linear-gradient(135deg,#ffeaf2_0%,#ffd6e5_100%)]",
  };
  return (
    <button
      onClick={onClick}
      className={`relative min-h-[160px] min-w-0 overflow-hidden rounded-[18px] border p-5 text-left shadow-[0_2px_8px_rgba(16,42,67,0.07)] transition-all duration-180 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(16,42,67,0.09)] ${
        active
          ? "border-foreground ring-2 ring-foreground/10"
          : "border-transparent hover:border-foreground/20"
      } ${tileBg[tone] ?? "bg-surface"} ${tones[tone]?.split(" ").find(c => c.startsWith("text-")) ?? ""}`}
    >
      <span
        className="pointer-events-none absolute -right-11 -bottom-21 h-[170px] w-[170px] rounded-full bg-white/18"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className={`text-[13px] font-bold ${tones[tone]?.split(" ").find(c => c.startsWith("text-")) ?? "text-muted-foreground"}`}>{label}</p>
        <span
          className={`grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-white/22 ring-1 ring-white/25 ${tones[tone]?.split(" ").find(c => c.startsWith("text-")) ?? ""}`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="relative z-1 mt-[18px] text-[30px] font-extrabold leading-none tracking-[-0.035em]">
        {value}
      </p>
      <p className="relative z-1 mt-3 border-t border-white/15 pt-2 text-[12px] opacity-78">
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
          tone="purple"
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