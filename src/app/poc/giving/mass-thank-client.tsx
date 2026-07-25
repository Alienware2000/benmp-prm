"use client";

import {
  CheckCircle2,
  LoaderCircle,
  MessageCircleMore,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { FeedbackNotice } from "@/components/feedback-notice";

type PreviewMessage = {
  name: string;
  to: string | null;
  body: string;
};

type Summary = {
  total: number;
  sendable: number;
  skippedNoPhone: number;
  optedOut: number;
  alreadySent: number;
  sample: PreviewMessage[];
};

type Report = {
  total: number;
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
  skippedByReason?: Record<string, number>;
};

type ApiResponse = {
  ok: boolean;
  data?: { summary?: Summary; report?: Report };
  error?: { message?: string };
};

async function requestBatch(confirm: boolean): Promise<ApiResponse> {
  const response = await fetch("/api/poc/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "thank_you", confirm }),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiResponse;
  if (!response.ok && !payload.error?.message) {
    payload.error = { message: `The server returned ${response.status}.` };
  }
  return payload;
}

function resultLine(report: Report): string {
  const accepted = report.sent + report.queued;
  const parts = [`${accepted} accepted by WhatsApp`];
  if (report.skipped > 0) parts.push(`${report.skipped} safely skipped`);
  if (report.failed > 0) parts.push(`${report.failed} failed`);
  return parts.join(" · ");
}

export function MassThankClient({
  provider,
  messagingReady,
  configurationNote,
}: {
  provider: string;
  messagingReady: boolean;
  configurationNote?: string;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setBusy("preview");
    setError(null);
    setReport(null);
    setConfirmed(false);
    try {
      const payload = await requestBatch(false);
      if (!payload.ok || !payload.data?.summary) {
        setError(
          payload.error?.message ?? "The thank-you list could not be prepared.",
        );
        return;
      }
      setSummary(payload.data.summary);
    } catch {
      setError(
        "The server could not be reached. Nothing was prepared or sent.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!summary || !confirmed || summary.sendable === 0) return;
    setBusy("send");
    setError(null);
    try {
      const payload = await requestBatch(true);
      if (!payload.ok || !payload.data?.report) {
        setError(payload.error?.message ?? "The thank-yous could not be sent.");
        return;
      }
      setReport(payload.data.report);
      setConfirmed(false);
    } catch {
      setError("The server could not be reached. The batch was not submitted.");
    } finally {
      setBusy(null);
    }
  }

  const sending = busy === "send";

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-md bg-success/10 text-success">
            <UsersRound className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Thank all eligible givers</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Builds one personal WhatsApp message per giver from successful
              payment records. It includes givers who are not yet in the partner
              directory, uses each recorded total, and excludes bank-only rows,
              opt-outs and acknowledgements already accepted.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={preview}
          disabled={busy !== null}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold transition hover:bg-background disabled:opacity-50"
        >
          {busy === "preview" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <MessageCircleMore className="h-4 w-4" aria-hidden />
          )}
          {busy === "preview"
            ? "Preparing thank-yous"
            : summary
              ? "Refresh preview"
              : "Prepare all thank-yous"}
        </button>
      </div>

      {!messagingReady && configurationNote && (
        <FeedbackNotice
          tone="warning"
          className="mx-4 mb-4"
          title="Live WhatsApp is not configured here"
        >
          {configurationNote}
        </FeedbackNotice>
      )}

      {error && (
        <FeedbackNotice
          tone="error"
          className="mx-4 mb-4"
          title="The batch could not be completed"
          supportingText="Nothing new was sent. You can retry safely."
          onDismiss={() => setError(null)}
        >
          {error}
        </FeedbackNotice>
      )}

      {summary && !report && (
        <div className="border-t border-border bg-background/50 p-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Ready to send
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-success">
                {summary.sendable}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Already thanked
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {summary.alreadySent}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                No WhatsApp number
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {summary.skippedNoPhone}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Opted out
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {summary.optedOut}
              </p>
            </div>
          </div>

          {summary.sample.length > 0 && (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {summary.sample.slice(0, 4).map((message, index) => (
                <div
                  key={`${message.to ?? message.name}-${index}`}
                  className="rounded-md border border-border bg-surface px-3 py-2.5"
                >
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {message.name}
                    {message.to ? ` · ${message.to}` : " · no number"}
                  </p>
                  <p className="mt-1 text-xs leading-5">{message.body}</p>
                </div>
              ))}
            </div>
          )}

          {summary.sendable > 0 ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex min-w-0 items-start gap-2.5 text-xs leading-5">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-700"
                />
                <span>
                  I reviewed the preview and approve sending{" "}
                  <b>{summary.sendable} personalized thank-yous</b>.
                </span>
              </label>
              <button
                type="button"
                onClick={send}
                disabled={!confirmed || !messagingReady || busy !== null}
                className="inline-flex min-h-10 flex-none items-center justify-center gap-2 rounded-md bg-success px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                )}
                {sending
                  ? "Sending thank-yous"
                  : `Send ${summary.sendable} thank-yous`}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              There are no new sendable thank-yous in this giving period.
            </p>
          )}
        </div>
      )}

      {report && (
        <div className="flex items-start gap-3 border-t border-border bg-emerald-50 px-4 py-4 text-emerald-950">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 flex-none text-success"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold">Thank-you batch submitted</p>
            <p className="mt-1 text-xs leading-5">{resultLine(report)}</p>
            <p className="mt-1 text-[11px] text-emerald-900/75">
              Provider: {provider}. Every attempt is stored in the message audit
              trail.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
