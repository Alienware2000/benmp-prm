"use client";

import {
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { buildThankYouMessage } from "@/lib/messages";
import { normalizePhone } from "@/lib/phone";

type SendResult = {
  to: string;
  body: string;
  audited: boolean;
  idempotentReplay: boolean;
  outcome: {
    status: "queued" | "sent";
    providerMessageId?: string;
  };
};

function providerLabel(provider: string): string {
  if (provider === "vonage") return "Vonage WhatsApp Sandbox";
  if (provider === "infobip") return "Infobip WhatsApp";
  if (provider === "meta-cloud-api") return "Meta Cloud API";
  if (provider === "twilio") return "Twilio WhatsApp";
  return "Demo mode";
}

export function GiftAcknowledgementClient({ provider }: { provider: string }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const destination = normalizePhone(phone);
  const amountMinor = Math.round(Number(amount) * 100);
  const message = useMemo(
    () =>
      fullName.trim().length >= 2 &&
      Number.isFinite(amountMinor) &&
      amountMinor > 0
        ? buildThankYouMessage(fullName, amountMinor)
        : "",
    [amountMinor, fullName],
  );
  const ready = Boolean(destination && message);
  const canSend = provider !== "mock" && ready && confirmed && !busy && !result;

  function resetConfirmation() {
    setConfirmed(false);
    setResult(null);
    setError(null);
    setIdempotencyKey("");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!canSend || !destination) return;
    setBusy(true);
    setError(null);
    const requestKey = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(requestKey);

    try {
      const response = await fetch("/api/poc/giving/test-acknowledgement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: requestKey,
          fullName,
          phone: destination,
          amountGhs: amount,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: SendResult;
        error?: { message?: string };
      };
      if (!response.ok || !payload.ok || !payload.data) {
        setError(payload.error?.message ?? "The message was not accepted.");
        return;
      }
      setResult(payload.data);
    } catch {
      setError("Could not reach the server. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={send}
      className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,1.1fr)]"
    >
      <section className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Test gift details</h2>
            <span className="text-xs font-medium text-success">
              {providerLabel(provider)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This sends the acknowledgement only. It does not add a gift to the
            ledger.
          </p>
        </div>

        <div className="grid gap-4 p-4">
          <label className="grid gap-1.5 text-xs font-semibold">
            Donor name
            <input
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                resetConfirmation();
              }}
              placeholder="David Antwi"
              autoComplete="name"
              className="h-11 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            Destination WhatsApp number
            <input
              type="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                resetConfirmation();
              }}
              placeholder="+1 475 365 9443"
              autoComplete="tel"
              className="h-11 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            Gift amount (GHS)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                resetConfirmation();
              }}
              placeholder="60"
              className="h-11 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3.5">
          <h2 className="text-sm font-semibold">Review before sending</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Check the destination and exact message together.
          </p>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-border px-4 py-4 text-sm">
          <dt className="text-xs font-medium text-muted-foreground">Donor</dt>
          <dd className="text-right font-semibold">
            {fullName.trim() || "Not entered"}
          </dd>
          <dt className="text-xs font-medium text-muted-foreground">
            WhatsApp destination
          </dt>
          <dd className="break-all text-right font-semibold tabular-nums text-success">
            {destination ?? "Enter an international number"}
          </dd>
          <dt className="text-xs font-medium text-muted-foreground">Amount</dt>
          <dd className="text-right font-semibold tabular-nums">
            {Number.isFinite(amountMinor) && amountMinor > 0
              ? `GHS ${(amountMinor / 100).toFixed(2)}`
              : "Not entered"}
          </dd>
        </dl>

        <div className="px-4 py-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Exact WhatsApp message
          </p>
          <p className="min-h-24 whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-3 text-sm leading-6">
            {message ||
              "Complete the donor name and gift amount to generate the message."}
          </p>

          <label className="mt-4 flex items-start gap-2.5 text-xs leading-5">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={!ready || Boolean(result)}
              className="mt-0.5 h-4 w-4 flex-none accent-[var(--success)]"
            />
            <span>
              I checked that this message should go to{" "}
              <b className="break-all">{destination ?? "the number above"}</b>.
            </span>
          </label>

          {error && (
            <p className="mt-3 text-xs font-medium text-danger">{error}</p>
          )}

          {result ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
              <div className="min-w-0 text-xs leading-5">
                <p className="font-semibold">
                  Message accepted for {result.to}
                </p>
                <p className="break-all text-emerald-800/80">
                  Provider reference:{" "}
                  {result.outcome.providerMessageId ?? "pending"}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-success px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <MessageCircle className="h-4 w-4" aria-hidden />
              )}
              {busy
                ? "Sending..."
                : destination
                  ? `Send to ${destination}`
                  : "Send WhatsApp"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-background/60 px-4 py-2.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
          Opt-outs and the demo allowlist are checked before delivery.
        </div>
      </section>
    </form>
  );
}
