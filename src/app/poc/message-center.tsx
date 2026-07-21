"use client";

import { useState } from "react";

type Summary = {
  total: number;
  sendable: number;
  skippedNoPhone: number;
  optedOut: number;
  thankYou: number;
  reminder: number;
  sample: Array<{
    kind: string;
    name: string;
    to: string | null;
    body: string;
  }>;
};

type Report = {
  total: number;
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
  skippedByReason?: Record<string, number>;
};

/** Explain skips as the safety features they are, not as failures. */
const SKIP_LABELS: Record<string, string> = {
  "not in allowlist": "held by safety allowlist",
  "opted out": "opted out",
  "no phone": "no phone number",
};

function reportLine(r: Report): string {
  const delivered = r.sent + r.queued;
  const parts = [`${delivered} sent`];
  for (const [reason, n] of Object.entries(r.skippedByReason ?? {})) {
    parts.push(`${n} ${SKIP_LABELS[reason] ?? reason}`);
  }
  const unexplained =
    r.skipped -
    Object.values(r.skippedByReason ?? {}).reduce((s, n) => s + n, 0);
  if (unexplained > 0) parts.push(`${unexplained} skipped`);
  if (r.failed > 0) parts.push(`${r.failed} failed`);
  return `${parts.join(" · ")} (of ${r.total})`;
}

type Kind = "thank_you" | "reminder";

async function post(kind: Kind, confirm: boolean) {
  const res = await fetch("/api/poc/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, confirm }),
  });
  return res.json() as Promise<{
    ok: boolean;
    data?: { summary?: Summary; report?: Report };
    error?: { message: string };
  }>;
}

function QueueRow({
  kind,
  count,
  title,
  subtitle,
  idleChip,
}: {
  kind: Kind;
  count: number;
  title: string;
  subtitle: string;
  idleChip: string;
}) {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const r = await post(kind, false);
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
      const r = await post(kind, true);
      if (r.ok && r.data?.report) setReport(r.data.report);
      else setError(r.error?.message ?? "Send failed.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const previewed = summary !== null;
  const sendable = summary?.sendable ?? 0;

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 border-t border-border px-4 py-4 first:border-t-0 sm:grid-cols-[auto_1fr_auto] sm:px-5">
      <span
        className={
          "min-w-[56px] text-right text-[21px] font-bold tabular-nums " +
          (kind === "thank_you" ? "text-success" : "text-warning")
        }
      >
        {count}
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        <span
          className={
            "rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (previewed
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning")
          }
        >
          {report ? "sent" : previewed ? "previewed" : idleChip}
        </span>
        <button
          onClick={preview}
          disabled={busy}
          className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-foreground transition hover:border-muted-foreground/40 disabled:opacity-45"
        >
          Preview
        </button>
        <button
          onClick={send}
          disabled={busy || !previewed || sendable === 0 || report !== null}
          title={
            !previewed ? "Preview first — nothing sends unseen" : undefined
          }
          className="rounded-lg bg-success px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-45"
        >
          {report ? "Sent" : previewed ? `Send ${sendable}` : "Send"}
        </button>
      </span>

      {error && <p className="col-span-full text-xs text-danger">{error}</p>}

      {summary && !report && (
        <div className="col-span-full grid gap-2 rounded-xl border border-border bg-background p-3">
          {summary.sample
            .filter((m) => m.kind === kind)
            .slice(0, 2)
            .map((m, i) => (
              <p
                key={i}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-5 text-foreground/80"
              >
                {m.body}
              </p>
            ))}
          <p className="text-[11px] text-muted-foreground">
            Showing 2 of{" "}
            {kind === "thank_you" ? summary.thankYou : summary.reminder} ·{" "}
            {summary.skippedNoPhone} skipped (no phone number)
            {summary.optedOut > 0 && <> · {summary.optedOut} opted out</>}
          </p>
        </div>
      )}

      {report && (
        <p className="col-span-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground">
          {reportLine(report)}
        </p>
      )}
    </div>
  );
}

export function MessageCenter({
  thankYous,
  reminders,
  provider,
}: {
  thankYous: number;
  reminders: number;
  provider: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <QueueRow
        kind="thank_you"
        count={thankYous}
        title="Thank-you messages"
        subtitle="WhatsApp · personalized by name and amount"
        idleChip="preview required"
      />
      <QueueRow
        kind="reminder"
        count={reminders}
        title="Gentle reminders"
        subtitle="WhatsApp · for registered partners who haven't given this period"
        idleChip="preview required"
      />
      <div className="flex flex-wrap justify-between gap-2 border-t border-border bg-background/60 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
        <span>
          Provider: <span className="font-semibold">{provider}</span>
          {provider === "mock" ? " · no real messages leave the system" : ""}
        </span>
        <span>
          Preview required before any send · opted-out numbers skipped · every
          send logged
        </span>
      </div>
    </div>
  );
}
