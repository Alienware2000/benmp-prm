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

type RegionRow = {
  region: string;
  totalGhsMinor: number;
  totalUsd: number;
  activePartners: number;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  month: string | null;
  totalGhsMinor: number;
  totalUsd: number;
  activePartners: number;
  fxRate: number;
  activeThresholdUsd: number;
  byMethod: MethodBreakdown;
  byRegion: RegionRow[];
  paymentCount: number;
};

const METHOD_ROWS: { key: keyof MethodBreakdown; label: string }[] = [
  { key: "mobile_money", label: "Mobile Money" },
  { key: "bank", label: "Bank" },
  { key: "cash", label: "Cash" },
  { key: "paystack", label: "Paystack" },
  { key: "other", label: "Other" },
];

function ghs(minor: number): string {
  return `GHS ${(minor / 100).toFixed(2)}`;
}

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function buildCsv(s: ApiResponse): string {
  const lines: string[] = [];
  lines.push("Metric,Value");
  lines.push(`Total (GHS),${(s.totalGhsMinor / 100).toFixed(2)}`);
  lines.push(`Total (USD),${s.totalUsd.toFixed(2)}`);
  lines.push(`Active Partners,${s.activePartners}`);
  lines.push(`Payment Count,${s.paymentCount}`);
  lines.push("");
  lines.push("By Method,GHS,USD");
  for (const m of METHOD_ROWS) {
    const minor = s.byMethod[m.key];
    lines.push(`${m.label},${(minor / 100).toFixed(2)},${(minor / s.fxRate).toFixed(2)}`);
  }
  lines.push("");
  lines.push("By Region,GHS,USD,Active Partners");
  for (const r of s.byRegion) {
    lines.push(`${r.region},${(r.totalGhsMinor / 100).toFixed(2)},${r.totalUsd.toFixed(2)},${r.activePartners}`);
  }
  return lines.join("\n");
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "executive-summary.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SummaryClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState("");

  const doFetch = useCallback(async (selectedMonth: string) => {
    const query = selectedMonth ? `?month=${selectedMonth}` : "";
    const res = await fetch(`/api/poc/giving/executive-summary${query}`);
    return (await res.json()) as ApiResponse;
  }, []);

  // Initial load — no setState before the await, so the effect is safe.
  useEffect(() => {
    void doFetch("")
      .then((json) => {
        if (json.ok) setData(json);
        else setError(json.error ?? "Failed to load data.");
        setLoading(false);
      })
      .catch(() => {
        setError("Network error.");
        setLoading(false);
      });
  }, [doFetch]);

  const handleMonthChange = (value: string) => {
    setMonth(value);
    setLoading(true);
    void doFetch(value)
      .then((json) => {
        if (json.ok) setData(json);
        else setError(json.error ?? "Failed to load data.");
        setLoading(false);
      })
      .catch(() => {
        setError("Network error.");
        setLoading(false);
      });
  };

  const handleExportCsv = () => {
    if (data) downloadCsv(buildCsv(data));
  };

  return (
    <div className="space-y-6">
      {/* Filters + export */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <input
          type="month"
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="rounded border border-border bg-input px-3 py-1.5 text-sm"
        />
        {month && (
          <button
            onClick={() => handleMonthChange("")}
            className="text-sm text-muted-foreground underline"
          >
            Clear month
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={!data}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground"
          >
            Print
          </button>
          <Link
            href="/poc/giving"
            className="text-sm text-muted-foreground underline"
          >
            ← Back to Giving
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {error && (
        <p className="rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>
      )}

      {!loading && !error && data && (
        <>
          {/* Headline cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Total GHS</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {ghs(data.totalGhsMinor)}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Total USD</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {usd(data.totalUsd)}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Active Partners</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {data.activePartners}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Payment Count</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {data.paymentCount}
              </p>
            </div>
          </div>

          {/* Formula note */}
          <p className="text-xs text-muted-foreground">
            1 USD = {data.fxRate} GHS · Active = Total USD ÷ ${data.activeThresholdUsd}
          </p>

          {/* Method breakdown */}
          <div>
            <h2 className="mb-2 text-sm font-bold text-foreground">By Method</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4 text-right">GHS</th>
                    <th className="py-2 pr-4 text-right">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {METHOD_ROWS.map((m) => {
                    const minor = data.byMethod[m.key];
                    return (
                      <tr key={m.key} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium text-foreground">{m.label}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                          {(minor / 100).toFixed(2)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                          {(minor / data.fxRate).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Region breakdown */}
          <div>
            <h2 className="mb-2 text-sm font-bold text-foreground">By Region</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Region</th>
                    <th className="py-2 pr-4 text-right">GHS</th>
                    <th className="py-2 pr-4 text-right">USD</th>
                    <th className="py-2 pr-4 text-right">Active Partners</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byRegion.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted-foreground">
                        No regional data.
                      </td>
                    </tr>
                  )}
                  {data.byRegion.map((r) => (
                    <tr key={r.region} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{r.region}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                        {(r.totalGhsMinor / 100).toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {r.totalUsd.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {r.activePartners}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}