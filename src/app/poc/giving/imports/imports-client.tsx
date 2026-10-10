"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Batch = {
  id: string;
  provider: string;
  filename: string;
  status: string;
  row_count: number;
  matched_count: number;
  ambiguous_count: number;
  file_hash: string | null;
  storage_path: string | null;
  created_at: string;
};

type ImportRow = {
  id: string;
  payment_reference: string | null;
  match_status: string;
  normalized_row: {
    payerName?: string | null;
    amountMinor?: number | null;
    transactionDate?: string;
  } | null;
  created_at: string;
};

const PROVIDERS = [
  { value: "", label: "All providers" },
  { value: "momo", label: "momo" },
  { value: "ecobank", label: "ecobank" },
  { value: "paystack_onetime", label: "paystack_onetime" },
  { value: "paystack_recurring", label: "paystack_recurring" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "processed", label: "processed" },
];

function providerBadgeClass(provider: string): string {
  switch (provider) {
    case "momo":
      return "bg-blue-100 text-blue-800";
    case "ecobank":
      return "bg-emerald-100 text-emerald-800";
    case "paystack_onetime":
      return "bg-purple-100 text-purple-800";
    case "paystack_recurring":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function matchBadgeClass(status: string): string {
  switch (status) {
    case "matched":
      return "bg-emerald-100 text-emerald-800";
    case "ambiguous":
      return "bg-amber-100 text-amber-800";
    case "unmatched":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatAmount(amountMinor: number | null | undefined): string {
  if (amountMinor == null) return "GHS —";
  return `GHS ${(amountMinor / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function shortHash(hash: string | null): string {
  if (!hash) return "—";
  return hash.slice(0, 8);
}

export function ImportsClient() {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (provider) params.set("provider", provider);
    if (status) params.set("status", status);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [provider, status]);

  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/poc/giving/imports${query}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load batches");
        const data = (await r.json()) as { ok: boolean; batches: Batch[] };
        if (!cancelled) {
          setBatches(data.batches);
          setLoadError(null);
          setLoadedQuery(query);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Load failed");
          setLoadedQuery(query);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const batchesLoading = loadedQuery !== query;

  const toggleBatch = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        setRows(null);
        setRowsError(null);
        return;
      }
      setExpandedId(id);
      setRows(null);
      setRowsError(null);
      setRowsLoading(true);
      try {
        const r = await fetch(`/api/poc/giving/imports/${encodeURIComponent(id)}/rows`);
        if (!r.ok) throw new Error("Failed to load rows");
        const data = (await r.json()) as { ok: boolean; rows: ImportRow[] };
        setRows(data.rows);
      } catch (e: unknown) {
        setRowsError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setRowsLoading(false);
      }
    },
    [expandedId],
  );

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/poc/giving"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to Giving
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded border border-border bg-input px-2 py-1 text-sm text-foreground"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-border bg-input px-2 py-1 text-sm text-foreground"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadError ? (
        <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {loadError}
        </div>
      ) : batchesLoading ? (
        <div className="text-sm text-muted-foreground">Loading batches…</div>
      ) : batches && batches.length > 0 ? (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">Filename</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Rows</th>
                <th className="px-3 py-2 text-right font-medium">Matched</th>
                <th className="px-3 py-2 text-right font-medium">Ambiguous</th>
                <th className="px-3 py-2 font-medium">Uploaded</th>
                <th className="px-3 py-2 font-medium">Hash</th>
                <th className="px-3 py-2 font-medium">Original</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <BatchRow
                  key={b.id}
                  batch={b}
                  expanded={expandedId === b.id}
                  onToggle={() => toggleBatch(b.id)}
                  rows={expandedId === b.id ? rows : null}
                  rowsLoading={expandedId === b.id && rowsLoading}
                  rowsError={expandedId === b.id ? rowsError : null}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
          No upload batches found.
        </div>
      )}
    </div>
  );
}

function BatchRow({
  batch,
  expanded,
  onToggle,
  rows,
  rowsLoading,
  rowsError,
}: {
  batch: Batch;
  expanded: boolean;
  onToggle: () => void;
  rows: ImportRow[] | null;
  rowsLoading: boolean;
  rowsError: string | null;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-border hover:bg-muted/50"
      >
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${providerBadgeClass(batch.provider)}`}
          >
            {batch.provider}
          </span>
        </td>
        <td className="px-3 py-2 text-foreground">{batch.filename}</td>
        <td className="px-3 py-2 text-muted-foreground">{batch.status}</td>
        <td className="px-3 py-2 text-right text-foreground">{batch.row_count}</td>
        <td className="px-3 py-2 text-right text-foreground">{batch.matched_count}</td>
        <td className="px-3 py-2 text-right text-foreground">{batch.ambiguous_count}</td>
        <td className="px-3 py-2 text-muted-foreground">{formatDate(batch.created_at)}</td>
        <td className="px-3 py-2">
          <code className="font-mono text-xs text-muted-foreground">
            {shortHash(batch.file_hash)}
          </code>
        </td>
        <td className="px-3 py-2">
          {batch.storage_path ? (
            <a
              href={`/api/poc/giving/imports/${batch.id}/file`}
              onClick={(event) => event.stopPropagation()}
              className="text-xs font-medium text-brand underline-offset-2 hover:underline"
            >
              Download
            </a>
          ) : (
            <span className="text-xs text-muted-foreground" title="Imported before the statement vault">
              —
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-muted/30">
          <td colSpan={9} className="px-3 py-3">
            {rowsLoading ? (
              <div className="text-sm text-muted-foreground">Loading rows…</div>
            ) : rowsError ? (
              <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {rowsError}
              </div>
            ) : !rows || rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No rows for this batch.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 font-medium">Reference</th>
                      <th className="px-2 py-1 font-medium">Match</th>
                      <th className="px-2 py-1 font-medium">Payer</th>
                      <th className="px-2 py-1 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-2 py-1 text-foreground">
                          {row.payment_reference ?? "—"}
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${matchBadgeClass(row.match_status)}`}
                          >
                            {row.match_status}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-foreground">
                          {row.normalized_row?.payerName ?? "—"}
                        </td>
                        <td className="px-2 py-1 text-right text-foreground">
                          {formatAmount(row.normalized_row?.amountMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}