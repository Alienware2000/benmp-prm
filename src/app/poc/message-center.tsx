"use client";

import {
  CircleDollarSign,
  CalendarRange,
  Crown,
  Archive,
  Gift,
  HeartHandshake,
  MessageSquare,
  Smartphone,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { FeedbackNotice } from "@/components/feedback-notice";
import {
  SPECIAL_MESSAGE_CATEGORY_LABELS,
  SPECIAL_MESSAGE_TEMPLATES,
  type SpecialMessageCategory,
} from "@/lib/message-templates";
import type { MessagingProvider } from "@/lib/messaging/types";
import type { AudienceCounts, AudienceKey } from "@/lib/poc/audiences";
import type { LegacyBatch } from "@/lib/poc/legacy-batches";
import { smsCost } from "@/lib/poc/sms-cost";
import {
  MessageAttachmentField,
  type MessageMediaAsset,
} from "./messages/message-attachment-field";

type Summary = {
  total: number;
  sendable: number;
  skippedNoPhone: number;
  optedOut: number;
  alreadySent?: number;
  thankYou: number;
  reminder: number;
  direct: number;
  sendLimit?: number;
  overSendLimit?: boolean;
  channel?: "whatsapp" | "sms";
  smsCost?: {
    characters: number;
    parts: number;
    creditsPerRecipient: number;
    creditsTotal: number;
    unicode: boolean;
    charactersUntilNextPart: number;
  };
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
  outcomes?: Array<{ status: string; reason?: string }>;
};

type AudienceOption = {
  key: AudienceKey;
  label: string;
  description: string;
  Icon: typeof Users;
};

const PRIMARY_AUDIENCES: AudienceOption[] = [
  {
    key: "everyone",
    label: "All partners",
    description: "Every saved partner, once per WhatsApp number",
    Icon: Users,
  },
  {
    key: "paid",
    label: "Gave in selected period",
    description: "People with a gift recorded in the period shown above",
    Icon: HeartHandshake,
  },
  {
    key: "unpaid",
    label: "No gift in selected period",
    description: "Registered partners with no gift in the period shown above",
    Icon: CircleDollarSign,
  },
];

const SPECIFIC_AUDIENCES: AudienceOption[] = [
  {
    key: "top",
    label: "Top 20 givers",
    description: "The 20 highest recorded totals in the selected period",
    Icon: Crown,
  },
  {
    key: "consistent",
    label: "Repeat givers",
    description: "2 or more gifts in the selected period, excluding the Top 20",
    Icon: Sparkles,
  },
  {
    key: "new",
    label: "Gift not linked to a profile",
    description: "A gift exists, but no registered partner record matches it",
    Icon: Gift,
  },
  {
    key: "legacy-ghana",
    label: "Old Ghana list (archived)",
    description:
      "Pre-cutover Ghana contacts, kept apart from partner records — broadcast only",
    Icon: Archive,
  },
];

const CHANNELS: Array<{
  key: "whatsapp" | "sms";
  label: string;
  description: string;
  Icon: typeof Users;
}> = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    description: "Free-form, with attachments. Needs a recent conversation.",
    Icon: MessageSquare,
  },
  {
    key: "sms",
    label: "SMS",
    description: "Reaches any number, no 24-hour window. Costs credits.",
    Icon: Smartphone,
  },
];

const SKIP_LABELS: Record<string, string> = {
  "not in allowlist": "held by safety allowlist",
  "opted out": "opted out",
  "no phone": "no phone number",
};

function providerLabel(provider: MessagingProvider): string {
  if (provider === "wali") return "WaliChat WhatsApp";
  if (provider === "whatchimp") return "WhatChimp WhatsApp";
  if (provider === "vonage") return "Vonage WhatsApp";
  if (provider === "infobip") return "Infobip WhatsApp";
  if (provider === "meta-cloud-api") return "Meta Cloud API";
  if (provider === "twilio") return "Twilio WhatsApp";
  return "Demo mode";
}

function reportLine(report: Report): string {
  const delivered = report.sent + report.queued;
  const parts = [`${delivered} sent`];
  for (const [reason, count] of Object.entries(report.skippedByReason ?? {})) {
    parts.push(`${count} ${SKIP_LABELS[reason] ?? reason}`);
  }
  const explained = Object.values(report.skippedByReason ?? {}).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (report.skipped > explained) {
    parts.push(`${report.skipped - explained} skipped`);
  }
  if (report.failed > 0) parts.push(`${report.failed} failed`);
  return `${parts.join(" · ")} (of ${report.total})`;
}

function reportFailure(report: Report): string | null {
  const reason = report.outcomes?.find(
    (outcome) => outcome.status === "failed" && outcome.reason,
  )?.reason;
  return reason ? reason.replace(/^(Wali|WaliChat)\s*:\s*/i, "") : null;
}

function amountToMinor(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return undefined;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

async function post({
  audience,
  confirm,
  message,
  minAmount,
  maxAmount,
  mediaAssetId,
  periodFrom,
  periodTo,
  batch,
  channel,
}: {
  audience: AudienceKey;
  confirm: boolean;
  message: string;
  minAmount: string;
  maxAmount: string;
  mediaAssetId: string;
  periodFrom: string;
  periodTo: string;
  batch: number | null;
  channel: "whatsapp" | "sms";
}) {
  const minAmountMinor = amountToMinor(minAmount);
  const maxAmountMinor = amountToMinor(maxAmount);
  const response = await fetch("/api/poc/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      audience,
      confirm,
      message,
      ...(minAmountMinor !== undefined ? { minAmountMinor } : {}),
      ...(maxAmountMinor !== undefined ? { maxAmountMinor } : {}),
      ...(mediaAssetId ? { mediaAssetId } : {}),
      ...(periodFrom ? { from: periodFrom } : {}),
      ...(periodTo ? { to: periodTo } : {}),
      ...(batch !== null ? { batch } : {}),
      channel,
    }),
  });
  return response.json() as Promise<{
    ok: boolean;
    data?: { summary?: Summary; report?: Report };
    error?: { message: string };
  }>;
}

function AudienceCard({
  option,
  count,
  selected,
  onSelect,
}: {
  option: AudienceOption;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.Icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        "grid min-h-[92px] w-full grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-lg border p-3 text-left transition " +
        (selected
          ? "border-success bg-success/5 ring-1 ring-success/20"
          : "border-border bg-background hover:border-success/40")
      }
    >
      <span
        className={
          "grid h-9 w-9 place-items-center rounded-md " +
          (selected
            ? "bg-success text-white"
            : "bg-surface text-muted-foreground")
        }
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <b className="text-sm text-foreground">{option.label}</b>
          <span className="text-xs font-semibold tabular-nums text-success">
            {count.toLocaleString("en-US")}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {option.description}
        </span>
      </span>
    </button>
  );
}

export function MessageCenter({
  initialAudience,
  counts,
  initialMessage,
  provider,
  messagingReady,
  configurationNote,
  periodLabel,
  periodFrom,
  periodTo,
  legacyBatches,
}: {
  initialAudience: AudienceKey;
  counts: AudienceCounts;
  initialMessage: string;
  provider: MessagingProvider;
  messagingReady: boolean;
  configurationNote?: string;
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  legacyBatches: LegacyBatch[];
}) {
  const [audience, setAudience] = useState<AudienceKey>(initialAudience);
  // Which fixed chunk of the legacy Ghana list to send. Only meaningful for that
  // audience; every other one sends in a single pass.
  const [batch, setBatch] = useState<number | null>(null);
  // WhatsApp or SMS. SMS is never the default: it is billed per 160-character part
  // per recipient, so choosing it has to be a deliberate act.
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [message, setMessage] = useState(initialMessage);
  const [preset, setPreset] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [attached, setAttached] = useState<MessageMediaAsset | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Local estimate for feedback while typing. The server re-prices with the
  // provider's own /sms/estimate before any send, so this can never be the only
  // thing standing between staff and a charge.
  const liveCost = smsCost(message, summary?.sendable ?? 0);

  function resetReview() {
    setSummary(null);
    setReport(null);
    setConfirmed(false);
    setError(null);
  }

  function chooseAudience(next: AudienceKey) {
    setAudience(next);
    setMinAmount("");
    setMaxAmount("");
    // Default to the first batch with anyone left in it, so the obvious next step is
    // preselected rather than staff having to work out where they left off.
    setBatch(
      next === "legacy-ghana"
        ? (legacyBatches.find((b) => b.remaining > 0)?.number ??
            legacyBatches[0]?.number ??
            null)
        : null,
    );
    resetReview();
  }

  function chooseChannel(next: "whatsapp" | "sms") {
    setChannel(next);
    // SMS carries no media; drop a staged attachment rather than let the server
    // silently strip it after staff thought it was going out.
    if (next === "sms") {
      setMediaId("");
      setAttached(null);
    }
    resetReview();
  }

  function chooseBatch(next: number) {
    setBatch(next);
    resetReview();
  }

  function choosePreset(value: string) {
    const next = SPECIAL_MESSAGE_TEMPLATES.find((item) => item.id === value);
    setPreset(value);
    if (!next) return;
    setMessage(next.body);
    resetReview();
  }

  async function preview() {
    setBusy("preview");
    setError(null);
    setReport(null);
    setConfirmed(false);
    try {
      const result = await post({
        audience,
        confirm: false,
        message,
        minAmount,
        maxAmount,
        mediaAssetId: mediaId,
        periodFrom,
        periodTo,
        batch,
        channel,
      });
      if (result.ok && result.data?.summary) {
        setSummary(result.data.summary);
      } else {
        setError(result.error?.message ?? "Could not prepare the preview.");
      }
    } catch {
      setError("Could not reach the server. Nothing was sent.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!summary || !confirmed || !messagingReady) return;
    setBusy("send");
    setError(null);
    try {
      const result = await post({
        audience,
        confirm: true,
        message,
        minAmount,
        maxAmount,
        mediaAssetId: mediaId,
        periodFrom,
        periodTo,
        batch,
        channel,
      });
      if (result.ok && result.data?.report) {
        setReport(result.data.report);
        setConfirmed(false);
      } else {
        setError(result.error?.message ?? "The messages could not be sent.");
      }
    } catch {
      setError("Could not reach the server. Nothing was sent.");
    } finally {
      setBusy(null);
    }
  }

  const amountRefinement = ["paid", "top", "consistent", "new"].includes(
    audience,
  );
  const invalidAmountRange =
    amountToMinor(minAmount) !== undefined &&
    amountToMinor(maxAmount) !== undefined &&
    (amountToMinor(minAmount) ?? 0) > (amountToMinor(maxAmount) ?? 0);
  const draftReady = message.trim().length > 0 && !invalidAmountRange;

  return (
    <div className="space-y-3">
      {!messagingReady && configurationNote && (
        <FeedbackNotice tone="warning" title="WhatsApp sending is unavailable">
          {configurationNote}
        </FeedbackNotice>
      )}

      <section className="rounded-lg border border-border bg-surface p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-success">
          Step 1
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Choose a group</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The platform selects the matching people from current records.
            </p>
          </div>
          <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold tabular-nums text-success">
            {counts[audience].toLocaleString("en-US")} records
          </span>
        </div>

        <div className="mt-3 flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2.5">
          <CalendarRange
            className="mt-0.5 h-4 w-4 flex-none text-success"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Selected giving period: {periodLabel}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
              Gift-based groups and amounts use only the records in this period.
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Message audience"
          className="mt-3 grid gap-2 sm:grid-cols-3"
        >
          {PRIMARY_AUDIENCES.map((option) => (
            <AudienceCard
              key={option.key}
              option={option}
              count={counts[option.key]}
              selected={audience === option.key}
              onSelect={() => chooseAudience(option.key)}
            />
          ))}
        </div>

        <details className="mt-2 rounded-md border border-border bg-background">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold">
            <SlidersHorizontal
              className="h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            More specific groups
          </summary>
          <div
            role="radiogroup"
            aria-label="Specific message audiences"
            className="grid gap-2 border-t border-border p-3 sm:grid-cols-3"
          >
            {SPECIFIC_AUDIENCES.map((option) => (
              <AudienceCard
                key={option.key}
                option={option}
                count={counts[option.key]}
                selected={audience === option.key}
                onSelect={() => chooseAudience(option.key)}
              />
            ))}
          </div>
        </details>

        {audience === "legacy-ghana" && legacyBatches.length > 0 && (
          <div className="mt-2 rounded-md border border-border bg-background p-3">
            <p className="text-xs font-semibold">
              Choose a batch
              <span className="ml-2 font-normal text-muted-foreground">
                this list is too large to send at once, so it goes out in{" "}
                {legacyBatches.length} parts
              </span>
            </p>
            <div
              role="radiogroup"
              aria-label="Legacy Ghana broadcast batches"
              className="mt-2 grid gap-2 sm:grid-cols-3"
            >
              {legacyBatches.map((option) => {
                const done = option.remaining === 0;
                return (
                  <button
                    key={option.number}
                    type="button"
                    role="radio"
                    aria-checked={batch === option.number}
                    onClick={() => chooseBatch(option.number)}
                    className={`rounded-md border p-2 text-left text-xs ${
                      batch === option.number
                        ? "border-foreground bg-muted"
                        : "border-border"
                    } ${done ? "opacity-60" : ""}`}
                  >
                    <span className="block font-semibold">
                      Batch {option.number}
                    </span>
                    <span className="block text-muted-foreground">
                      {done
                        ? "all sent"
                        : `${option.remaining.toLocaleString("en-US")} to send`}
                    </span>
                    {option.alreadySent > 0 && !done && (
                      <span className="block text-muted-foreground">
                        {option.alreadySent.toLocaleString("en-US")} already
                        sent
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Batches are fixed — batch 3 is always the same people. Anyone
              already messaged is skipped, so re-sending a batch cannot reach
              them twice.
            </p>
          </div>
        )}

        {amountRefinement && (
          <details className="mt-2 rounded-md border border-border bg-background">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold">
              <CircleDollarSign
                className="h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              Refine by gift amount
              <span className="font-normal text-muted-foreground">
                optional
              </span>
            </summary>
            <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold">
                Minimum amount (GHS)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={minAmount}
                  onChange={(event) => {
                    setMinAmount(event.target.value);
                    resetReview();
                  }}
                  placeholder="No minimum"
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-success"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Maximum amount (GHS)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={maxAmount}
                  onChange={(event) => {
                    setMaxAmount(event.target.value);
                    resetReview();
                  }}
                  placeholder="No maximum"
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-success"
                />
              </label>
              {invalidAmountRange && (
                <p className="text-xs font-medium text-red-700 sm:col-span-2">
                  The minimum amount must be lower than the maximum.
                </p>
              )}
            </div>
          </details>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-success">
              Step 2
            </p>
            <h2 className="mt-1 text-sm font-semibold">Write the message</h2>
          </div>
          <span className="text-xs font-medium text-success">
            {providerLabel(provider)}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Names and gift amounts are filled in for each person when available.
        </p>

        <div className="mt-3 grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold">
            Message draft
            <select
              value={preset}
              onChange={(event) => choosePreset(event.target.value)}
              className="h-11 min-w-0 rounded-md border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-success"
            >
              <option value="">Keep current wording</option>
              {(
                Object.entries(SPECIAL_MESSAGE_CATEGORY_LABELS) as Array<
                  [SpecialMessageCategory, string]
                >
              ).map(([category, label]) => (
                <optgroup key={category} label={label}>
                  {SPECIAL_MESSAGE_TEMPLATES.filter(
                    (template) => template.category === category,
                  ).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <span className="pb-0.5 text-[11px] leading-5 text-muted-foreground">
            20 editable drafts
          </span>
        </div>

        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <p className="text-xs font-semibold">Send by</p>
          <div
            role="radiogroup"
            aria-label="Message channel"
            className="mt-2 grid gap-2 sm:grid-cols-2"
          >
            {CHANNELS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={channel === option.key}
                onClick={() => chooseChannel(option.key)}
                className={`flex items-start gap-2 rounded-md border p-2 text-left text-xs ${
                  channel === option.key
                    ? "border-foreground bg-muted"
                    : "border-border"
                }`}
              >
                <option.Icon
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span>
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {channel === "sms" && (
            <p className="mt-2 text-xs text-muted-foreground">
              SMS is charged per 160-character part, per person — and it cannot
              carry an attachment.
            </p>
          )}
        </div>

        <label className="mt-3 grid gap-1.5 text-xs font-semibold">
          Message
          <textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setPreset("");
              resetReview();
            }}
            maxLength={1000}
            rows={5}
            className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2.5 text-sm font-normal leading-6 outline-none focus:border-success"
          />
          <span className="flex flex-wrap justify-between gap-2 font-normal text-muted-foreground">
            <span>
              Personalization: <b>{"{name}"}</b> and <b>{"{amount}"}</b>
            </span>
            <span className="tabular-nums">{message.length}/1000</span>
          </span>
          {channel === "sms" && message.length > 0 && (
            <span className="font-normal text-muted-foreground">
              {liveCost.parts} SMS part{liveCost.parts === 1 ? "" : "s"} ·{" "}
              {liveCost.creditsPerRecipient} credit
              {liveCost.creditsPerRecipient === 1 ? "" : "s"} per person ·{" "}
              <b className="tabular-nums">{liveCost.charactersUntilNextPart}</b>{" "}
              character
              {liveCost.charactersUntilNextPart === 1 ? "" : "s"} left before
              this costs {liveCost.parts + 1}
              {liveCost.unicode
                ? " · an emoji or special character has cut the limit to 70 per part"
                : ""}
            </span>
          )}
        </label>

        {channel === "whatsapp" && (
          <div className="mt-3">
            <MessageAttachmentField
              id="bulk-message-attachment"
              value={mediaId}
              onChange={(next) => {
                setMediaId(next);
                resetReview();
              }}
              onAssetChange={setAttached}
              onError={setError}
            />
          </div>
        )}

        <button
          type="button"
          onClick={preview}
          disabled={!draftReady || busy !== null}
          className="mt-3 min-h-10 rounded-md bg-success px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "preview"
            ? "Preparing..."
            : summary
              ? "Refresh preview"
              : "Review people and message"}
        </button>
      </section>

      {error && (
        <FeedbackNotice
          tone="error"
          title="This message step could not be completed"
          supportingText="Your group, filters, wording and attachment are still here. Nothing new was sent."
          onDismiss={() => setError(null)}
        >
          {error}
        </FeedbackNotice>
      )}

      <section className="rounded-lg border border-border bg-surface p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-success">
          Step 3
        </p>
        <h2 className="mt-1 text-sm font-semibold">Review and send</h2>

        {!summary && !report && (
          <p className="mt-2 rounded-md border border-dashed border-border bg-background px-3 py-4 text-xs leading-5 text-muted-foreground">
            Use <b>Review people and message</b> above to see who will receive
            it. Nothing is sent during review.
          </p>
        )}

        {summary && !report && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-background px-3 py-2.5">
                <span className="block text-[11px] text-muted-foreground">
                  Ready to send
                </span>
                <b className="mt-1 block text-lg tabular-nums text-success">
                  {summary.sendable.toLocaleString("en-US")}
                </b>
              </div>
              <div className="rounded-md bg-background px-3 py-2.5">
                <span className="block text-[11px] text-muted-foreground">
                  No phone or opted out
                </span>
                <b className="mt-1 block text-lg tabular-nums">
                  {(summary.skippedNoPhone + summary.optedOut).toLocaleString(
                    "en-US",
                  )}
                </b>
              </div>
              <div className="rounded-md bg-background px-3 py-2.5">
                <span className="block text-[11px] text-muted-foreground">
                  Already acknowledged
                </span>
                <b className="mt-1 block text-lg tabular-nums">
                  {audience === "paid" ? (summary.alreadySent ?? 0) : "—"}
                </b>
              </div>
            </div>

            {attached && (
              <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                Attachment:{" "}
                <b className="text-foreground">{attached.filename}</b>
              </p>
            )}

            {summary.channel === "sms" && summary.smsCost && (
              <FeedbackNotice
                tone={summary.smsCost.parts > 2 ? "warning" : "info"}
                title={`This send costs ${summary.smsCost.creditsTotal.toLocaleString("en-US")} SMS credits`}
                supportingText="Charged per 160-character part, per person. Nothing has been sent yet."
              >
                {summary.smsCost.parts} part
                {summary.smsCost.parts === 1 ? "" : "s"} per message ×{" "}
                {summary.sendable.toLocaleString("en-US")} people. Shortening
                the message below{" "}
                {summary.smsCost.parts === 1
                  ? "160"
                  : ((summary.smsCost.parts - 1) * 153).toString()}{" "}
                characters would drop it to{" "}
                {(
                  (summary.smsCost.parts - 1) *
                  summary.sendable
                ).toLocaleString("en-US")}
                .
                {summary.smsCost.unicode
                  ? " An emoji or special character is in the message, which cuts each part from 160 characters to 70."
                  : ""}
              </FeedbackNotice>
            )}

            {summary.overSendLimit && (
              <FeedbackNotice
                tone="warning"
                title="Choose a smaller group for this send"
                supportingText="The full group remains selected; nothing has been sent."
              >
                This preview has {summary.sendable.toLocaleString("en-US")}{" "}
                sendable people. One immediate send can contain up to{" "}
                {(summary.sendLimit ?? 2_000).toLocaleString("en-US")}{" "}
                recipients.
              </FeedbackNotice>
            )}

            <div>
              <p className="text-xs font-semibold">Message examples</p>
              <div className="mt-2 grid gap-2">
                {summary.sample.slice(0, 4).map((item, index) => (
                  <div
                    key={`${item.to ?? "none"}-${index}`}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  >
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {item.name} · {item.to ?? "no phone"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-foreground">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {summary.sendable > 0 ? (
              <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <label className="flex items-start gap-2.5 text-xs leading-5">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-none accent-[var(--success)]"
                  />
                  <span>
                    I reviewed this group and approve sending to{" "}
                    <b>{summary.sendable.toLocaleString("en-US")} people</b>.
                  </span>
                </label>
                <button
                  type="button"
                  onClick={send}
                  disabled={
                    !confirmed ||
                    !messagingReady ||
                    busy !== null ||
                    summary.overSendLimit
                  }
                  className="min-h-10 rounded-md bg-success px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "send"
                    ? "Sending..."
                    : `Send ${summary.sendable.toLocaleString("en-US")} messages`}
                </button>
              </div>
            ) : (
              <p className="border-t border-border pt-3 text-xs font-medium text-muted-foreground">
                There are no sendable messages in this group.
              </p>
            )}
          </div>
        )}

        {report && report.failed === 0 && (
          <FeedbackNotice tone="info" className="mt-3" title="Send complete">
            {reportLine(report)}
          </FeedbackNotice>
        )}

        {report && report.failed > 0 && (
          <FeedbackNotice
            tone="error"
            className="mt-3"
            title={
              report.sent + report.queued > 0
                ? "Some messages were not sent"
                : "Messages were not sent"
            }
            supportingText={reportLine(report)}
          >
            {reportFailure(report) ??
              "The messaging provider rejected one or more messages. Nothing marked as failed was delivered."}
          </FeedbackNotice>
        )}

        <p className="mt-3 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
          Opt-outs are skipped and every attempt is recorded.
        </p>
      </section>
    </div>
  );
}
