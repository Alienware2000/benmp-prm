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
    sourceRowId: string;
    transactionDate: string;
    amountMinor: number;
    currency: string;
    payerName: string | null;
    payerPhoneOrAccount: string | null;
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
        const initial: Record<string, Decision> = {};
        for (const row of (body as PreviewResponse).rows) {
          if (row.status !== "review") continue;
          initial[row.row.sourceRowId] = row.candidates[0]
            ? { action: "match", partnerId: row.candidates[0].id }
            : { action: "create", name: row.row.payerName ?? "" };
        }
        setDecisions(initial);
      } else {
        setCommitted(body as CommitResponse);
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
                  Match to an existing partner, create a new partner, or dismiss non-gift rows.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => send("commit")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Commit matched gifts
              </button>
            </div>

            {reviewRows.length === 0 ? (
              <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                No review rows. Safe matches can be committed directly.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {reviewRows.map((item) => {
                  const decision = decisions[item.row.sourceRowId] ?? { action: "dismiss" };
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
                      <div className="mt-3 grid gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
                        <select
                          className={inputClass}
                          value={decision.action}
                          onChange={(event) => {
                            const action = event.target.value as Decision["action"];
                            if (action === "dismiss") updateDecision(item.row.sourceRowId, { action });
                            if (action === "match") updateDecision(item.row.sourceRowId, { action, partnerId: item.candidates[0]?.id ?? preview.partnerOptions[0]?.id ?? "" });
                            if (action === "create") updateDecision(item.row.sourceRowId, { action, name: item.row.payerName ?? "" });
                          }}
                        >
                          <option value="match">Match existing</option>
                          <option value="create">Create new</option>
                          <option value="dismiss">Dismiss</option>
                        </select>
                        {decision.action === "match" && (
                          <select
                            className={inputClass}
                            value={decision.partnerId}
                            onChange={(event) => updateDecision(item.row.sourceRowId, { action: "match", partnerId: event.target.value })}
                          >
                            {preview.partnerOptions.map((partner) => (
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
            )}
          </section>
        </>
      )}

      {committed && (
        <section className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
          <p className="font-bold">Upload committed.</p>
          <p className="mt-1">
            {committed.counts.insertedOrAlreadyPresent} gifts accepted, {committed.counts.autoMatched} auto-matched, {committed.counts.manualMatched} manually matched, {committed.counts.created} partners created, {committed.counts.dismissed} dismissed.
          </p>
          <Link href="/poc/giving" className="mt-3 inline-flex h-9 items-center rounded-md bg-brand px-3 text-xs font-semibold text-white">
            View giving ledger
          </Link>
        </section>
      )}
    </div>
  );
}
