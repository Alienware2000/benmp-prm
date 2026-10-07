"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type FiledEntry = {
  churchId: string;
  churchName: string;
  hubLabel: string;
  status: string;
  totalCashMinor: number;
  totalRegistered: number;
  activePartners: number;
  newRegistrations: number;
  lapsed: number;
  submittedAt: string;
};

type NotFiledEntry = {
  churchId: string;
  churchName: string;
  hubLabel: string;
};

type MonitoringResponse = {
  ok: boolean;
  month: string;
  filed: FiledEntry[];
  notFiled: NotFiledEntry[];
  summary: { totalChurches: number; filedCount: number; notFiledCount: number };
  error?: string;
};

function ghs(minor: number): string {
  return `GHS ${(minor / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  promoted: "bg-green-100 text-green-800",
  flagged: "bg-yellow-100 text-yellow-800",
};

export function CashMonitoringClient() {
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const doFetch = useCallback(async (selectedMonth: string) => {
    const res = await fetch(`/api/poc/cash/monitoring?month=${selectedMonth}`);
    return (await res.json()) as MonitoringResponse;
  }, []);

  useEffect(() => {
    void doFetch(month).then((json) => {
      setData(json);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [month, doFetch]);

  const handleMonthChange = (value: string) => {
    setMonth(value);
    setLoading(true);
    void doFetch(value).then((json) => {
      setData(json);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  const filedRate = data && data.summary.totalChurches > 0
    ? ((data.summary.filedCount / data.summary.totalChurches) * 100).toFixed(1)
    : "0";

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
        <Link href="/poc/giving" className="ml-auto text-sm text-muted-foreground underline">
          ← Back to Giving
        </Link>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && data && !data.ok && (
        <p className="rounded bg-red-100 p-3 text-sm text-red-800">{data.error ?? "Failed to load."}</p>
      )}

      {!loading && data?.ok && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Total Churches</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{data.summary.totalChurches}</p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Filed</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-green-700">{data.summary.filedCount}</p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Not Filed</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-red-700">{data.summary.notFiledCount}</p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Filing Rate</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{filedRate}%</p>
            </div>
          </div>

          {/* Filed table */}
          <div>
            <h2 className="mb-2 text-sm font-bold text-foreground">Filed ({data.filed.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Church</th>
                    <th className="py-2 pr-4">Hub</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Cash</th>
                    <th className="py-2 pr-4 text-right">Registered</th>
                    <th className="py-2 pr-4 text-right">Active</th>
                    <th className="py-2 pr-4 text-right">New</th>
                    <th className="py-2 pr-4 text-right">Lapsed</th>
                    <th className="py-2 pr-4">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filed.length === 0 && (
                    <tr><td colSpan={9} className="py-4 text-center text-muted-foreground">No submissions for this month.</td></tr>
                  )}
                  {data.filed.map((f) => (
                    <tr key={f.churchId} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{f.churchName}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{f.hubLabel}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[f.status] ?? "bg-gray-100 text-gray-800"}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-foreground">{ghs(f.totalCashMinor)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{f.totalRegistered}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{f.activePartners}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{f.newRegistrations}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{f.lapsed}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(f.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Not filed table */}
          <div>
            <h2 className="mb-2 text-sm font-bold text-foreground">Not Yet Filed ({data.notFiled.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Church</th>
                    <th className="py-2 pr-4">Hub</th>
                  </tr>
                </thead>
                <tbody>
                  {data.notFiled.length === 0 && (
                    <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">All churches have filed!</td></tr>
                  )}
                  {data.notFiled.map((n) => (
                    <tr key={n.churchId} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{n.churchName}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{n.hubLabel}</td>
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