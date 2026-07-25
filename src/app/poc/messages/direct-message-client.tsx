"use client";

import {
  CheckCircle2,
  ImageIcon,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Pencil,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Upload,
  Video,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FeedbackNotice } from "@/components/feedback-notice";
import {
  attachmentExceedsProviderLimit,
  attachmentLimitBytes,
} from "@/lib/messaging/media-policy";
import type { MessagingProvider } from "@/lib/messaging/types";
import { normalizePhone } from "@/lib/phone";

type MediaAsset = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "video" | "audio" | "document";
  url: string;
  caption: string | null;
};

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

function providerLabel(provider: MessagingProvider): string {
  if (provider === "wali") return "WaliChat WhatsApp";
  if (provider === "whatchimp") return "WhatChimp WhatsApp";
  if (provider === "vonage") return "Vonage WhatsApp";
  if (provider === "infobip") return "Infobip WhatsApp";
  if (provider === "meta-cloud-api") return "Meta Cloud API";
  if (provider === "twilio") return "Twilio WhatsApp";
  return "Demo mode";
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function cleanProviderError(message: string): string {
  return message.replace(
    /^(Wali|WaliChat|WhatChimp|Twilio|Vonage|Infobip|Meta)\s*:\s*/i,
    "",
  );
}

export function DirectMessageClient({
  provider,
  initialName = "",
  initialPhone = "",
  initialMessage = "",
}: {
  provider: MessagingProvider;
  initialName?: string;
  initialPhone?: string;
  initialMessage?: string;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState(initialMessage);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [mediaId, setMediaId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const attachmentRef = useRef<HTMLSelectElement>(null);

  const destination = normalizePhone(phone);
  const attached = useMemo(
    () => assets.find((asset) => asset.id === mediaId) ?? null,
    [assets, mediaId],
  );
  const attachmentTooLarge = Boolean(
    attached && attachmentExceedsProviderLimit(provider, attached.sizeBytes),
  );
  const attachmentLimit = attachmentLimitBytes(provider);
  const compatibleAlternative = useMemo(() => {
    if (!attached || !attachmentTooLarge) return null;
    return (
      assets
        .filter(
          (asset) =>
            asset.id !== attached.id &&
            asset.kind === attached.kind &&
            !attachmentExceedsProviderLimit(provider, asset.sizeBytes),
        )
        .sort((a, b) => b.sizeBytes - a.sizeBytes)[0] ?? null
    );
  }, [assets, attached, attachmentTooLarge, provider]);
  const ready = Boolean(destination && message.trim());
  const canSend =
    provider !== "mock" &&
    ready &&
    confirmed &&
    !attachmentTooLarge &&
    !busy &&
    !result;

  useEffect(() => {
    fetch("/api/poc/media")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok && Array.isArray(payload.data?.assets)) {
          setAssets(payload.data.assets);
        }
      })
      .catch(() => {});
  }, []);

  function resetSendState() {
    setConfirmed(false);
    setResult(null);
    setError(null);
    setIdempotencyKey("");
  }

  function startAnother() {
    resetSendState();
  }

  function editMessage() {
    resetSendState();
    requestAnimationFrame(() => {
      messageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      messageRef.current?.focus();
    });
  }

  function changeAttachment() {
    resetSendState();
    requestAnimationFrame(() => {
      attachmentRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      attachmentRef.current?.focus();
    });
  }

  function startFresh() {
    setFullName("");
    setPhone("");
    setMessage("");
    setMediaId("");
    resetSendState();
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const signed = await fetch("/api/poc/media/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      }).then((response) => response.json());
      if (!signed.ok) {
        setError(
          signed.error?.message ?? "The attachment could not be uploaded.",
        );
        return;
      }

      const transferred = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!transferred.ok) {
        setError("The attachment could not be transferred to the media vault.");
        return;
      }

      const confirmedUpload = await fetch("/api/poc/media/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: signed.data.path,
          filename: file.name,
        }),
      }).then((response) => response.json());
      if (!confirmedUpload.ok) {
        setError(
          confirmedUpload.error?.message ??
            "The attachment could not be added to the media vault.",
        );
        return;
      }

      const list = await fetch("/api/poc/media").then((response) =>
        response.json(),
      );
      setAssets(list?.data?.assets ?? []);
      setMediaId(confirmedUpload.data.id);
      resetSendState();
    } catch {
      setError("The attachment upload was interrupted. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!canSend || !destination) return;
    setBusy(true);
    setError(null);
    const requestKey = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(requestKey);

    try {
      const response = await fetch("/api/poc/messages/direct", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: requestKey,
          fullName,
          phone: destination,
          message: message.trim(),
          ...(mediaId ? { mediaAssetId: mediaId } : {}),
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
      className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)]"
    >
      <section className="min-w-0 rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Compose message</h2>
            <span className="text-xs font-medium text-success">
              {providerLabel(provider)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <label className="grid gap-1.5 text-xs font-semibold">
            Recipient name{" "}
            <span className="font-normal text-muted-foreground">optional</span>
            <input
              ref={nameRef}
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                resetSendState();
              }}
              placeholder="David Antwi"
              autoComplete="name"
              className="h-11 min-w-0 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-semibold">
            WhatsApp number
            <input
              type="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                resetSendState();
              }}
              placeholder="+233 24 000 0000"
              autoComplete="tel"
              className="h-11 min-w-0 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-semibold">
            Message
            <textarea
              ref={messageRef}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                resetSendState();
              }}
              maxLength={1000}
              rows={6}
              placeholder="Write the exact WhatsApp message..."
              className="min-h-36 min-w-0 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm font-normal leading-6 outline-none focus:border-success"
            />
            <span className="text-right font-normal tabular-nums text-muted-foreground">
              {message.length}/1000
            </span>
          </label>

          <div className="grid gap-1.5 text-xs font-semibold">
            <label htmlFor="direct-message-attachment">Attachment</label>
            <div className="flex items-center gap-2">
              <select
                ref={attachmentRef}
                id="direct-message-attachment"
                value={mediaId}
                onChange={(event) => {
                  setMediaId(event.target.value);
                  resetSendState();
                }}
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
              >
                <option value="">No attachment</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.kind === "image"
                      ? "Image"
                      : asset.kind === "video"
                        ? "Video"
                        : "File"}{" "}
                    — {asset.filename}
                    {attachmentExceedsProviderLimit(provider, asset.sizeBytes)
                      ? " — needs compression"
                      : ""}
                  </option>
                ))}
              </select>
              <label className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-semibold transition hover:bg-background">
                {uploading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden />
                )}
                {uploading ? "Uploading" : "Upload"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/mpeg,audio/ogg,application/pdf"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            {attachmentTooLarge && (
              <FeedbackNotice
                tone="warning"
                className="mt-1"
                title={`This ${attached?.kind ?? "file"} cannot be sent on the current plan`}
                action={
                  compatibleAlternative
                    ? {
                        label: `Use ${compatibleAlternative.filename} (${formatFileSize(compatibleAlternative.sizeBytes)})`,
                        onClick: () => {
                          setMediaId(compatibleAlternative.id);
                          resetSendState();
                        },
                      }
                    : undefined
                }
                supportingText={
                  compatibleAlternative
                    ? undefined
                    : "Choose or upload a compressed copy to continue."
                }
              >
                {attached?.filename} is{" "}
                {attached ? formatFileSize(attached.sizeBytes) : "too large"}.
                The current limit is{" "}
                {attachmentLimit
                  ? formatFileSize(attachmentLimit)
                  : "smaller than this file"}
                .
              </FeedbackNotice>
            )}
          </div>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3.5">
          <h2 className="text-sm font-semibold">Review and send</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing is sent until the destination is confirmed below.
          </p>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-border px-4 py-4 text-sm">
          <dt className="text-xs font-medium text-muted-foreground">
            Recipient
          </dt>
          <dd className="text-right font-semibold">
            {fullName.trim() || "Name not provided"}
          </dd>
          <dt className="text-xs font-medium text-muted-foreground">
            WhatsApp destination
          </dt>
          <dd className="break-all text-right font-semibold tabular-nums text-success">
            {destination ?? "Enter an international number"}
          </dd>
        </dl>

        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Exact WhatsApp message
          </p>
          <div className="mt-1.5 min-h-28 whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-3 text-sm leading-6">
            {message.trim() || (
              <span className="text-muted-foreground">
                Write a message to preview it here.
              </span>
            )}
          </div>

          {attached && (
            <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
              {attached.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attached.url}
                  alt={attached.caption ?? attached.filename}
                  className="max-h-52 w-full object-cover"
                />
              ) : attached.kind === "video" ? (
                <video
                  src={attached.url}
                  controls
                  preload="metadata"
                  className="max-h-52 w-full bg-black object-contain"
                />
              ) : null}
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                {attached.kind === "image" ? (
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                ) : attached.kind === "video" ? (
                  <Video className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="truncate">{attached.filename}</span>
              </div>
            </div>
          )}

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
            <FeedbackNotice
              tone="error"
              className="mt-4"
              title="Message was not sent"
              supportingText="Your recipient, message and attachment are still here."
              onDismiss={() => setError(null)}
            >
              {cleanProviderError(error)}
            </FeedbackNotice>
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
                {attached && (
                  <p className="mt-0.5 truncate text-emerald-800/80">
                    Attachment: {attached.filename}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startAnother}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-emerald-800 px-2.5 py-1 font-semibold text-white transition hover:bg-emerald-900"
                  >
                    <Repeat2 className="h-3.5 w-3.5" aria-hidden />
                    Send another
                  </button>
                  <button
                    type="button"
                    onClick={editMessage}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-semibold text-emerald-950 transition hover:bg-emerald-100"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit message
                  </button>
                  <button
                    type="button"
                    onClick={changeAttachment}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-semibold text-emerald-950 transition hover:bg-emerald-100"
                  >
                    <Paperclip className="h-3.5 w-3.5" aria-hidden />
                    Change attachment
                  </button>
                  <button
                    type="button"
                    onClick={startFresh}
                    className="inline-flex min-h-8 items-center gap-1.5 px-1.5 py-1 font-semibold text-emerald-900 underline underline-offset-2"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Start fresh
                  </button>
                </div>
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
                : error
                  ? destination
                    ? `Try again to ${destination}`
                    : "Try sending again"
                  : destination
                    ? `Send to ${destination}`
                    : "Send WhatsApp"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-background/60 px-4 py-2.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
          Opt-outs, confirmation and message auditing stay active for every
          number.
        </div>
      </section>
    </form>
  );
}
