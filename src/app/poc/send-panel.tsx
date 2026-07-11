"use client";

import { useState } from "react";

type Summary = {
  total: number;
  sendable: number;
  skippedNoPhone: number;
  thankYou: number;
  reminder: number;
  sample: Array<{ kind: string; name: string; to: string | null; body: string }>;
};

type Report = {
  total: number;
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
};

async function post(confirm: boolean) {
  const res = await fetch("/api/poc/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm }),
  });
  return res.json() as Promise<{ ok: boolean; data?: { summary?: Summary; report?: Report }; error?: { message: string } }>;
}

export function PocSend() {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const r = await post(false);
      if (r.ok && r.data?.summary) setSummary(r.data.summary);
      else setError(r.error?.message ?? "Could not build the preview.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const r = await post(true);
      if (r.ok && r.data?.report) setReport(r.data.report);
      else setError(r.error?.message ?? "Send failed.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={preview}
          disabled={busy}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          Preview messages
        </button>
        {summary && (
          <button
            onClick={send}
            disabled={busy || summary.sendable === 0}
            className="rounded-lg bg-sidebar px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Send {summary.sendable} now
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && !report && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {summary.thankYou} thank-you{summary.thankYou === 1 ? "" : "s"} · {summary.reminder} reminder
            {summary.reminder === 1 ? "" : "s"} · {summary.sendable} sendable · {summary.skippedNoPhone} skipped (no
            phone)
          </p>
          <ul className="space-y-2">
            {summary.sample.map((m, i) => (
              <li key={i} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <span className="font-medium capitalize text-foreground">{m.kind.replace("_", " ")}</span>
                <span className="text-muted-foreground"> → {m.to ?? "no phone"}</span>
                <p className="mt-1 text-muted-foreground">{m.body}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Sending uses the configured provider (mock until Twilio is set). Trial Twilio only reaches
            verified numbers / sandbox-joined WhatsApp.
          </p>
        </div>
      )}

      {report && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          Sent {report.sent} · queued {report.queued} · skipped {report.skipped} · failed {report.failed} (of{" "}
          {report.total})
        </div>
      )}
    </div>
  );
}
