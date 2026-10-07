"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type StatusBreakdown = Record<string, number>;

type ChurchRow = {
  churchId: string;
  churchName: string;
  hubId: string;
  hubLabel: string;
  regionCode: string;
  regionName: string;
  country: string;
  partnerCount: number;
  byStatus: StatusBreakdown;
};

type HubRollup = {
  hubId: string;
  hubLabel: string;
  regionCode: string;
  partnerCount: number;
  churchCount: number;
};

type CountryRollup = {
  country: string;
  partnerCount: number;
  churchCount: number;
};

type RegionRollup = {
  regionCode: string;
  regionName: string;
  partnerCount: number;
  churchCount: number;
};

type ApiResponse = {
  churches: ChurchRow[];
  rollups: {
    byHub: HubRollup[];
    byCountry: CountryRollup[];
    byRegion: RegionRollup[];
  };
  unassigned: {
    partnerCount: number;
    byStatus: StatusBreakdown;
  };
};

const STATUS_COLUMNS: { key: string; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "new", label: "New" },
  { key: "needs_follow_up", label: "Follow-up" },
  { key: "inactive", label: "Inactive" },
  { key: "other", label: "Other" },
];

export function PartnersByChurchClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRollups, setShowRollups] = useState(false);

  const doFetch = useCallback(async () => {
    const res = await fetch("/api/poc/partners/by-church");
    return (await res.json()) as ApiResponse & { ok: boolean; error?: string };
  }, []);

  // Initial load — no setState before the await, so the effect is safe.
  useEffect(() => {
    void doFetch().then((json) => {
      if (json.ok) setData(json);
      else setError(json.error ?? "Failed to load data.");
      setLoading(false);
    }).catch(() => {
      setError("Network error.");
      setLoading(false);
    });
  }, [doFetch]);

  const totalPartners = data
    ? data.churches.reduce((s, c) => s + c.partnerCount, 0) +
      data.unassigned.partnerCount
    : 0;

  const topRegions = data?.rollups.byRegion.slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/poc"
          className="ml-auto text-sm text-muted-foreground underline"
        >
          ← Back to POC
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
              <p className="text-xs text-muted-foreground">Total Partners</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {totalPartners.toLocaleString()}
              </p>
            </div>
            {topRegions.map((r) => (
              <div key={r.regionCode} className="rounded border border-border p-3">
                <p className="text-xs text-muted-foreground">{r.regionName}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  {r.partnerCount.toLocaleString()}
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
                  <th className="py-2 pr-4 text-right">Partners</th>
                  {STATUS_COLUMNS.map((s) => (
                    <th key={s.key} className="py-2 pr-4 text-right">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.churches.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-muted-foreground">
                      No partners found in churches.
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
                      {c.partnerCount.toLocaleString()}
                    </td>
                    {STATUS_COLUMNS.map((s) => {
                      const v = c.byStatus[s.key] ?? 0;
                      return (
                        <td key={s.key} className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                          {v > 0 ? v.toLocaleString() : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unassigned */}
          {data.unassigned.partnerCount > 0 && (
            <div className="rounded border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                Unassigned (no church): {data.unassigned.partnerCount.toLocaleString()}{" "}
                <span className="text-muted-foreground">partners</span>
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
                      partnerCount: r.partnerCount,
                      byStatus: {},
                      churchCount: r.churchCount,
                    }))}
                  />
                </div>
                {/* By Country */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-foreground">By Country</h3>
                  <RollupTable
                    rows={data.rollups.byCountry.map((c) => ({
                      name: c.country,
                      partnerCount: c.partnerCount,
                      byStatus: {},
                      churchCount: c.churchCount,
                    }))}
                  />
                </div>
                {/* By Hub */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-foreground">By Hub</h3>
                  <RollupTable
                    rows={data.rollups.byHub.map((h) => ({
                      name: h.hubLabel,
                      partnerCount: h.partnerCount,
                      byStatus: {},
                      churchCount: h.churchCount,
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
  partnerCount: number;
  byStatus: StatusBreakdown;
  churchCount: number;
};

function RollupTable({ rows }: { rows: RollupRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4 text-right">Partners</th>
            <th className="py-2 pr-4 text-right">Churches</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border/50">
              <td className="py-2 pr-4 font-medium text-foreground">{r.name}</td>
              <td className="py-2 pr-4 text-right font-bold tabular-nums text-foreground">
                {r.partnerCount.toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {r.churchCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}