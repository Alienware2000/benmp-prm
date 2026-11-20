"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, LoaderCircle, TriangleAlert } from "lucide-react";
import type { PaymentSource } from "@/lib/poc/payment-upload";

type Source = PaymentSource;

type ImportResponse = {
  ok: true;
  counts: {
    recorded: number;
    linked: number;
    totalMinor: number;
    rejected: number;
    skipped: number;
  };
  warnings?: string[];
};

type ErrorResponse = {
  ok?: boolean;
  error?: string;
  existingBatch?: { filename: string; created_at: string; row_count: number };
};

const inputClass =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand";

function ghs(minor: number): string {
  return `GHS ${(minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function readJsonResponse(response: Response): Promise<ErrorResponse> {
  const text = await response.text();
  if (!text.trim()) return { ok: false, error: `Server returned an empty response (${response.status}).` };
  try {
    return JSON.parse(text) as ErrorResponse;
  } catch {
    return { ok: false, error: `Server returned a non-JSON response (${response.status}).` };
  }
}

/**
 * Statement upload (Decision 0046): every credit line goes straight into the
 * giving ledger under the payer's name and number. No review step.
 */
export function GivingUploadClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("momo");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function upload() {
    if (!file) {
      setError("Choose a statement file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set("source", source);
    form.set("file", file);
    try {
      const response = await fetch("/api/poc/giving/upload", { method: "POST", body: form });
      const body = await readJsonResponse(response);
      if (body.error === "duplicate_file" && body.existingBatch) {
        throw new Error(
          `This file was already imported on ${new Date(body.existingBatch.created_at).toLocaleDateString("en-GB")} (${body.existingBatch.filename}, ${body.existingBatch.row_count} lines).`,
        );
      }
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Upload failed.");
      setResult(body as unknown as ImportResponse);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
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
                setResult(null);
              }}
              className={inputClass}
            >
              <option value="momo">MoMo</option>
              <option value="ecobank">Ecobank</option>
              <option value="stanbic">Stanbic (Excel or PDF)</option>
              <option value="zenith">Zenith (PDF)</option>
              <option value="fidelity">Fidelity (PDF)</option>
              <option value="paystack_onetime">Paystack One-time</option>
              <option value="paystack_recurring">Paystack Recurring</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              File
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx,.pdf,text/csv,application/pdf"
              className={inputClass + " file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold"}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={upload}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Upload and import
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          MoMo, bank (Ecobank, Stanbic, Zenith, Fidelity) and Paystack statements. Every credit is recorded in the giving
          ledger under the payer&apos;s name and number. Bank PDFs must be the bank&apos;s downloaded statement, not a scan.
          The same file is never imported twice.
        </p>
      </section>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {(result?.warnings ?? []).map((warning) => (
        <p
          key={warning}
          className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {warning}
        </p>
      ))}

      {result && (
        <section className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
          <p className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-4 w-4" /> Statement imported.
          </p>
          <p className="mt-1">
            {result.counts.recorded.toLocaleString("en-US")} credits recorded, {ghs(result.counts.totalMinor)}.{" "}
            {result.counts.linked.toLocaleString("en-US")} of them are from people already on the partner list.
            {result.counts.skipped > 0 && ` ${result.counts.skipped} non-credit lines skipped.`}
            {result.counts.rejected > 0 && ` ${result.counts.rejected} lines could not be read.`}
          </p>
          <Link href="/poc/giving" className="mt-3 inline-flex h-9 items-center rounded-md bg-brand px-3 text-xs font-semibold text-white">
            View giving ledger
          </Link>
        </section>
      )}
    </div>
  );
}
