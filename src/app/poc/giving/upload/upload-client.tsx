"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, LoaderCircle, TriangleAlert } from "lucide-react";

type Source = "momo" | "ecobank";

type PreviewPartner = {
  id: string;
  fullName: string;
  momoPhoneNumber: string | null;
  whatsappNumber: string | null;
  church: string | null;
  country: string | null;
};

type PreviewRow = {
  row: {
    source: Source;
    sourceRowId: string;
    transactionDate: string;
    amountMinor: number;
    currency: string;
    payerName: string | null;
    payerPhoneOrAccount: string | null;
    providerReference: string;
    rawRow: Record<string, string>;
  };
  status: "auto" | "review";
  reason: string;
  partner: PreviewPartner | null;
  candidates: PreviewPartner[];
};

type PreviewResponse = {
  ok: true;
  counts: { rows: number; auto: number; review: number; rejected: number; skipped: number };
  rows: PreviewRow[];
  partnerOptions: Array<{ id: string; name: string; phone: string | null; church: string | null }>;
  rejects: Array<{ index: number; reason: string }>;
  skipped: number;
};

type CommitResponse = {
  ok: true;
  counts: {
    insertedOrAlreadyPresent: number;
    autoMatched: number;
    manualMatched: number;
    created: number;
    dismissed: number;
    deferred: number;
    rejected: number;
    skipped: number;
  };
};

type Decision =
  | { action: "dismiss" }
  | { action: "match"; partnerId: string }
  | { action: "create"; name: string };

const inputClass =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand";
const REVIEW_STORAGE_KEY = "benmp-pending-giving-review-v1";

type PendingReviewRow = PreviewRow & { queuedAt: string };

function loadPendingReview(): PendingReviewRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingReviewRow[]) : [];
  } catch {
    return [];
  }
}

function money(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Not dated" : date.toLocaleDateString("en-GB");
}

export function GivingUploadClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("momo");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [committed, setCommitted] = useState<CommitResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [pendingReview, setPendingReview] = useState<PendingReviewRow[]>(loadPendingReview);

  function savePending(rows: PendingReviewRow[]) {
    setPendingReview(rows);
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(rows));
  }

  const reviewRows = useMemo(
    () => preview?.rows.filter((row) => row.status === "review") ?? [],
    [preview],
  );

  async function send(action: "preview" | "commit") {
    if (!file) {
      setError("Choose a statement file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setCommitted(null);
    const form = new FormData();
    form.set("action", action);
    form.set("source", source);
    form.set("file", file);
    if (action === "commit") form.set("decisions", JSON.stringify(decisions));
    try {
      const response = await fetch("/api/poc/giving/upload", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Upload failed.");
      if (action === "preview") {
        setPreview(body as PreviewResponse);
        setDecisions({});
      } else {
        const commitBody = body as CommitResponse;
        setCommitted(commitBody);
        if (preview) {
          const now = new Date().toISOString();
          const queued = reviewRows.map((row) => ({ ...row, queuedAt: now }));
          const existingIds = new Set(pendingReview.map((row) => row.row.sourceRowId));
          savePending([...pendingReview, ...queued.filter((row) => !existingIds.has(row.row.sourceRowId))]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateDecision(rowId: string, decision: Decision) {
    setDecisions((current) => ({ ...current, [rowId]: decision }));
  }

  async function commitPending() {
    const rowsToProcess = pendingReview.filter((row) => decisions[row.row.sourceRowId]);
    if (rowsToProcess.length === 0) {
      setError("Choose at least one pending review action first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("action", "commitDeferred");
      form.set("rows", JSON.stringify(rowsToProcess.map((row) => row.row)));
      form.set("decisions", JSON.stringify(decisions));
      const response = await fetch("/api/poc/giving/upload", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Review commit failed.");
      const processedIds = new Set(rowsToProcess.map((row) => row.row.sourceRowId));
      savePending(pendingReview.filter((row) => !processedIds.has(row.row.sourceRowId)));
      setDecisions((current) => {
        const next = { ...current };
        for (const id of processedIds) delete next[id];
        return next;
      });
      setCommitted(body as CommitResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review commit failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Statement type
            </label>
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value as Source);
                setPreview(null);
                setCommitted(null);
              }}
              className={inputClass}
            >
              <option value="momo">MoMo CSV</option>
              <option value="ecobank">Ecobank XLS</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              File
            </label>
            <input
              ref={fileRef}
              type="file"
              accept={source === "momo" ? ".csv,text/csv" : ".xls,.xlsx"}
              className={inputClass + " file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold"}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setCommitted(null);
              }}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => send("preview")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Preview upload
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          MoMo uses the fixed CSV columns and matches by payer number first. Ecobank imports credit rows only and extracts donor names from narration.
        </p>
      </section>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {preview && (
        <>
          <section className="grid gap-3 sm:grid-cols-5">
            {[
              ["Rows", preview.counts.rows],
              ["Auto", preview.counts.auto],
              ["Review", preview.counts.review],
              ["Rejected", preview.counts.rejected],
              ["Skipped", preview.counts.skipped],
            ].map(([label, value]) => (
              <article key={label} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
              </article>
            ))}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold">Rows needing review</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  These rows will be saved for later review. They do not block importing safe matches.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => send("commit")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Import safe matches
              </button>
            </div>

            {reviewRows.length === 0 ? (
              <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                No review rows. Safe matches can be imported directly.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {reviewRows.map((item) => {
                  return (
                    <article key={item.row.sourceRowId} className="rounded-md border border-border bg-background p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold">{item.row.payerName || "Unknown giver"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {dateLabel(item.row.transactionDate)} · {money(item.row.amountMinor, item.row.currency)} · {item.reason}
                          </p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-[11px] font-semibold text-warning">
                          <TriangleAlert className="h-3.5 w-3.5" /> Review
                        </span>
                      </div>
                      <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                        Saved after import; review later below.
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {committed && (
        <section className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
          <p className="font-bold">Upload committed.</p>
          <p className="mt-1">
            {committed.counts.insertedOrAlreadyPresent} gifts accepted, {committed.counts.autoMatched} auto-matched, {committed.counts.manualMatched} manually matched, {committed.counts.created} partners created, {committed.counts.dismissed} dismissed, {committed.counts.deferred} deferred for later review.
          </p>
          <Link href="/poc/giving" className="mt-3 inline-flex h-9 items-center rounded-md bg-brand px-3 text-xs font-semibold text-white">
            View giving ledger
          </Link>
        </section>
      )}

      {pendingReview.length > 0 && (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold">Pending review queue</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                These uploaded rows did not block import. Resolve them whenever staff have time.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={commitPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save selected review actions
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {pendingReview.map((item) => {
              const decision = decisions[item.row.sourceRowId] ?? { action: "dismiss" };
              const partnerOptions = preview?.partnerOptions ?? [];
              return (
                <article key={item.row.sourceRowId} className="rounded-md border border-border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold">{item.row.payerName || "Unknown giver"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateLabel(item.row.transactionDate)} · {money(item.row.amountMinor, item.row.currency)} · queued {dateLabel(item.queuedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-muted-foreground underline"
                      onClick={() => savePending(pendingReview.filter((row) => row.row.sourceRowId !== item.row.sourceRowId))}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
                    <select
                      className={inputClass}
                      value={decision.action}
                      onChange={(event) => {
                        const action = event.target.value as Decision["action"];
                        if (action === "dismiss") updateDecision(item.row.sourceRowId, { action });
                        if (action === "match") updateDecision(item.row.sourceRowId, { action, partnerId: item.candidates[0]?.id ?? partnerOptions[0]?.id ?? "" });
                        if (action === "create") updateDecision(item.row.sourceRowId, { action, name: item.row.payerName ?? "" });
                      }}
                    >
                      <option value="dismiss">Leave dismissed</option>
                      <option value="match">Match existing</option>
                      <option value="create">Create new</option>
                    </select>
                    {decision.action === "match" && (
                      <select
                        className={inputClass}
                        value={decision.partnerId}
                        onChange={(event) => updateDecision(item.row.sourceRowId, { action: "match", partnerId: event.target.value })}
                      >
                        {[...item.candidates.map((p) => ({ id: p.id, name: p.fullName, phone: p.momoPhoneNumber ?? p.whatsappNumber, church: p.church })), ...partnerOptions].map((partner) => (
                          <option key={partner.id} value={partner.id}>
                            {partner.name}{partner.phone ? ` · ${partner.phone}` : ""}{partner.church ? ` · ${partner.church}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {decision.action === "create" && (
                      <input
                        className={inputClass}
                        value={decision.name}
                        placeholder="New partner name"
                        onChange={(event) => updateDecision(item.row.sourceRowId, { action: "create", name: event.target.value })}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
