"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type MethodBreakdown = {
  mobile_money: number;
  bank: number;
  cash: number;
  paystack: number;
  other: number;
};

type ChurchRow = {
  churchId: string;
  churchName: string;
  hubId: string;
  hubLabel: string;
  regionCode: string;
  regionName: string;
  country: string;
  totalMinor: number;
  byMethod: MethodBreakdown;
  paymentCount: number;
};

type HubRollup = {
  hubId: string;
  hubLabel: string;
  regionCode: string;
  totalMinor: number;
  byMethod: MethodBreakdown;
  churchCount: number;
};

type CountryRollup = {
  country: string;
  totalMinor: number;
  byMethod: MethodBreakdown;
  churchCount: number;
};

type RegionRollup = {
  regionCode: string;
  regionName: string;
  totalMinor: number;
  byMethod: MethodBreakdown;
  churchCount: number;
};

type ApiResponse = {
  ok: true;
  churches: ChurchRow[];
  rollups: {
    byHub: HubRollup[];
    byCountry: CountryRollup[];
    byRegion: RegionRollup[];
  };
  unattributed: {
    totalMinor: number;
    paymentCount: number;
    byMethod: MethodBreakdown;
  };
};

function ghs(minor: number): string {
  return `GHS ${(minor / 100).toFixed(2)}`;
}

const METHOD_LABELS: { key: keyof MethodBreakdown; label: string }[] = [
  { key: "mobile_money", label: "MoMo" },
  { key: "bank", label: "Bank" },
  { key: "cash", label: "Cash" },
  { key: "paystack", label: "Paystack" },
  { key: "other", label: "Other" },
];

export function ByChurchClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  const [showRollups, setShowRollups] = useState(false);

  const doFetch = useCallback(async (selectedMonth: string) => {
    const query = selectedMonth ? `?month=${selectedMonth}` : "";
    const res = await fetch(`/api/poc/giving/by-church${query}`);
    return (await res.json()) as ApiResponse & { ok: boolean; error?: string };
  }, []);

  // Initial load — no setState before the await, so the effect is safe.
  useEffect(() => {
    void doFetch("").then((json) => {
      if (json.ok) setData(json);
      else setError(json.error ?? "Failed to load data.");
      setLoading(false);
    }).catch(() => {
      setError("Network error.");
      setLoading(false);
    });
  }, [doFetch]);

  const handleMonthChange = (value: string) => {
    setMonth(value);
    setLoading(true);
    void doFetch(value).then((json) => {
      if (json.ok) setData(json);
      else setError(json.error ?? "Failed to load data.");
      setLoading(false);
    }).catch(() => {
      setError("Network error.");
      setLoading(false);
    });
  };


  const grandTotal = data
    ? data.churches.reduce((s, c) => s + c.totalMinor, 0) +
      data.unattributed.totalMinor
    : 0;

  const topRegions = data?.rollups.byRegion.slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="rounded border border-border bg-input px-3 py-1.5 text-sm"
        />
        {month && (
          <button
            onClick={() => setMonth("")}
            className="text-sm text-muted-foreground underline"
          >
            Clear month
          </button>
        )}
        <Link
          href="/poc/giving"
          className="ml-auto text-sm text-muted-foreground underline"
        >
          ← Back to Giving
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {error && (
        <p className="rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Grand Total</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {ghs(grandTotal)}
              </p>
            </div>
            {topRegions.map((r) => (
              <div key={r.regionCode} className="rounded border border-border p-3">
                <p className="text-xs text-muted-foreground">{r.regionName}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  {ghs(r.totalMinor)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.churchCount} churches
                </p>
              </div>
            ))}
          </div>

          {/* Church table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4">Church</th>
                  <th className="py-2 pr-4">Hub</th>
                  <th className="py-2 pr-4">Region</th>
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  {METHOD_LABELS.map((m) => (
                    <th key={m.key} className="py-2 pr-4 text-right">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-2 pr-4 text-right">Payments</th>
                </tr>
              </thead>
              <tbody>
                {data.churches.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-4 text-center text-muted-foreground">
                      No attributed payments found.
                    </td>
                  </tr>
                )}
                {data.churches.map((c) => (
                  <tr key={c.churchId} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {c.churchName}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.hubLabel}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.regionName}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.country}</td>
                    <td className="py-2 pr-4 text-right font-bold tabular-nums text-foreground">
                      {ghs(c.totalMinor)}
                    </td>
                    {METHOD_LABELS.map((m) => (
                      <td key={m.key} className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {c.byMethod[m.key] > 0 ? ghs(c.byMethod[m.key]) : "—"}
                      </td>
                    ))}
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {c.paymentCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unattributed */}
          {data.unattributed.totalMinor > 0 && (
            <div className="rounded border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                Unattributed (no matched partner): {ghs(data.unattributed.totalMinor)}{" "}
                <span className="text-muted-foreground">across {data.unattributed.paymentCount} payments</span>
              </p>
            </div>
          )}

          {/* Roll-ups */}
          <div>
            <button
              onClick={() => setShowRollups((s) => !s)}
              className="text-sm font-medium text-foreground underline"
            >
              {showRollups ? "Hide" : "Show"} roll-ups (by hub, country, region)
            </button>
            {showRollups && (
              <div className="mt-3 space-y-6">
                {/* By Region */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-foreground">By Region</h3>
                  <RollupTable
                    rows={data.rollups.byRegion.map((r) => ({
                      name: r.regionName,
                      totalMinor: r.totalMinor,
                      byMethod: r.byMethod,
                      count: r.churchCount,
                      countLabel: "churches",
                    }))}
                  />
                </div>
                {/* By Country */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-foreground">By Country</h3>
                  <RollupTable
                    rows={data.rollups.byCountry.map((c) => ({
                      name: c.country,
                      totalMinor: c.totalMinor,
                      byMethod: c.byMethod,
                      count: c.churchCount,
                      countLabel: "churches",
                    }))}
                  />
                </div>
                {/* By Hub */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-foreground">By Hub</h3>
                  <RollupTable
                    rows={data.rollups.byHub.map((h) => ({
                      name: h.hubLabel,
                      totalMinor: h.totalMinor,
                      byMethod: h.byMethod,
                      count: h.churchCount,
                      countLabel: "churches",
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type RollupRow = {
  name: string;
  totalMinor: number;
  byMethod: MethodBreakdown;
  count: number;
  countLabel: string;
};

function RollupTable({ rows }: { rows: RollupRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4 text-right">Total</th>
            {METHOD_LABELS.map((m) => (
              <th key={m.key} className="py-2 pr-4 text-right">
                {m.label}
              </th>
            ))}
            <th className="py-2 pr-4 text-right">Churches</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border/50">
              <td className="py-2 pr-4 font-medium text-foreground">{r.name}</td>
              <td className="py-2 pr-4 text-right font-bold tabular-nums text-foreground">
                {ghs(r.totalMinor)}
              </td>
              {METHOD_LABELS.map((m) => (
                <td key={m.key} className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                  {r.byMethod[m.key] > 0 ? ghs(r.byMethod[m.key]) : "—"}
                </td>
              ))}
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {r.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}