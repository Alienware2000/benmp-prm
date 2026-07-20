"use client";

import { MessageCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { buildThankYouMessage } from "@/lib/messages";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

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

function AssistedWhatsApp() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const amountMinor = Math.round(Number(amount) * 100);
  const message = useMemo(
    () =>
      name.trim() && Number.isFinite(amountMinor) && amountMinor > 0
        ? buildThankYouMessage(name, amountMinor)
        : "",
    [amountMinor, name],
  );
  const whatsappUrl = buildWhatsAppUrl(phone, message);

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-border bg-emerald-50/50 px-4 py-3 sm:px-5">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">
            Send one WhatsApp
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            Available while automated sending is pending approval
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 flex-none items-center gap-2 rounded-lg bg-success px-3.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Compose
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-emerald-50/50 px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">
          Send one WhatsApp
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Close"
          aria-label="Close WhatsApp composer"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1.25fr_0.7fr]">
        <label className="grid gap-1.5 text-xs font-medium text-foreground">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Kofi Mensah"
            className="h-10 min-w-0 rounded-lg border border-border bg-surface px-3 text-sm outline-none transition focus:border-success focus:ring-2 focus:ring-success/15"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-foreground">
          WhatsApp number
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+233 24 000 0000"
            className="h-10 min-w-0 rounded-lg border border-border bg-surface px-3 text-sm outline-none transition focus:border-success focus:ring-2 focus:ring-success/15"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-foreground">
          Amount (GHS)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="60"
            className="h-10 min-w-0 rounded-lg border border-border bg-surface px-3 text-sm outline-none transition focus:border-success focus:ring-2 focus:ring-success/15"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-h-16 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-xs leading-5 text-foreground/80">
          {message || "The personalized thank-you will appear here."}
        </div>
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 flex-none items-center justify-center gap-2 rounded-lg bg-success px-4 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Open WhatsApp
          </a>
        ) : (
          <span className="inline-flex h-10 flex-none cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-success px-4 text-xs font-semibold text-white opacity-40">
            <MessageCircle className="h-4 w-4" aria-hidden />
            Open WhatsApp
          </span>
        )}
      </div>
    </div>
  );
}

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
      <AssistedWhatsApp />
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
