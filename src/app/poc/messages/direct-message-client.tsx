"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  ImageIcon,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Pencil,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FeedbackNotice } from "@/components/feedback-notice";
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
  contextNote,
  messagingReady,
  configurationNote,
}: {
  provider: MessagingProvider;
  initialName?: string;
  initialPhone?: string;
  initialMessage?: string;
  contextNote?: string;
  messagingReady: boolean;
  configurationNote?: string;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState(initialMessage);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [incompatibleAssets, setIncompatibleAssets] = useState<MediaAsset[]>(
    [],
  );
  const [mediaId, setMediaId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const ready = Boolean(destination && message.trim());
  const canSend = messagingReady && ready && confirmed && !busy && !result;

  useEffect(() => {
    fetch("/api/poc/media")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok && Array.isArray(payload.data?.assets)) {
          setAssets(payload.data.assets);
          setIncompatibleAssets(
            Array.isArray(payload.data?.incompatible)
              ? payload.data.incompatible
              : [],
          );
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
      setIncompatibleAssets(list?.data?.incompatible ?? []);
      setMediaId(confirmedUpload.data.id);
      resetSendState();
    } catch {
      setError("The attachment upload was interrupted. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment() {
    setMediaId("");
    resetSendState();
  }

  async function deleteAssets(
    doomed: MediaAsset[],
    confirmation: string,
  ): Promise<void> {
    if (deleting || doomed.length === 0 || !window.confirm(confirmation))
      return;
    setDeleting(true);
    setError(null);
    try {
      const results = await Promise.all(
        doomed.map(async (asset) => {
          const response = await fetch(
            `/api/poc/media?id=${encodeURIComponent(asset.id)}`,
            { method: "DELETE" },
          );
          const payload = await response.json().catch(() => ({}));
          return {
            asset,
            ok: response.ok && payload.ok,
            message: payload.error?.message as string | undefined,
          };
        }),
      );
      const failed = results.filter((result) => !result.ok);
      const deletedIds = new Set(
        results.filter((result) => result.ok).map((result) => result.asset.id),
      );
      setAssets((current) =>
        current.filter((asset) => !deletedIds.has(asset.id)),
      );
      setIncompatibleAssets((current) =>
        current.filter((asset) => !deletedIds.has(asset.id)),
      );
      if (deletedIds.has(mediaId)) setMediaId("");
      resetSendState();
      if (failed.length > 0) {
        setError(
          failed[0].message ??
            `${failed.length} attachment${failed.length === 1 ? "" : "s"} could not be deleted.`,
        );
      }
    } catch {
      setError("The attachment could not be deleted. Nothing else changed.");
    } finally {
      setDeleting(false);
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
      className="grid w-full min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)]"
    >
      {contextNote && (
        <div className="flex min-w-0 items-start gap-3 border-l-4 border-success bg-emerald-50 px-4 py-3 text-emerald-950 lg:col-span-2">
          <CircleDollarSign
            className="mt-0.5 h-5 w-5 flex-none text-success"
            aria-hidden
          />
          <p className="min-w-0 text-xs leading-5">{contextNote}</p>
        </div>
      )}

      {!messagingReady && configurationNote && (
        <FeedbackNotice
          tone="warning"
          className="lg:col-span-2"
          title="Live WhatsApp is not configured in this deployment"
        >
          {configurationNote}
        </FeedbackNotice>
      )}

      <section className="min-w-0 rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3.5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <h2 className="text-sm font-semibold">Compose message</h2>
            <span className="text-[11px] font-medium text-success sm:text-xs">
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
              className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
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
              className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
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
              className="min-h-32 w-full min-w-0 resize-y rounded-md border border-border bg-background px-3 py-3 text-sm font-normal leading-6 outline-none focus:border-success"
            />
            <span className="text-right font-normal tabular-nums text-muted-foreground">
              {message.length}/1000
            </span>
          </label>

          <div className="grid gap-1.5 text-xs font-semibold">
            <label htmlFor="direct-message-attachment">Attachment</label>
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
                  </option>
                ))}
              </select>
              <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-semibold transition hover:bg-background sm:w-auto">
                {uploading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden />
                )}
                {uploading ? "Uploading" : attached ? "Replace" : "Add file"}
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

            {attached && (
              <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                <span className="mr-auto min-w-0 text-xs font-normal text-muted-foreground">
                  <b className="text-foreground">{attached.filename}</b>{" "}
                  <span className="tabular-nums">
                    · {formatFileSize(attached.sizeBytes)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={removeAttachment}
                  className="inline-flex h-8 items-center gap-1 rounded border border-border bg-surface px-2.5 text-xs font-semibold hover:bg-background"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Remove
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() =>
                    void deleteAssets(
                      [attached],
                      `Permanently delete ${attached.filename} from the BENMP media library?`,
                    )
                  }
                  className="inline-flex h-8 items-center gap-1 rounded border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete file
                </button>
              </div>
            )}

            {incompatibleAssets.length > 0 && (
              <FeedbackNotice
                tone="warning"
                className="mt-1"
                title={`${incompatibleAssets.length} unusable attachment${incompatibleAssets.length === 1 ? "" : "s"} hidden`}
                action={{
                  label: deleting
                    ? "Deleting..."
                    : `Delete ${incompatibleAssets.length === 1 ? "file" : "files"}`,
                  onClick: () =>
                    void deleteAssets(
                      incompatibleAssets,
                      `Permanently delete ${incompatibleAssets.length} attachment${incompatibleAssets.length === 1 ? "" : "s"} that exceed the current WhatsApp limit?`,
                    ),
                }}
                supportingText="New uploads are checked against the active provider before they enter the library."
              >
                {incompatibleAssets
                  .map(
                    (asset) =>
                      `${asset.filename} (${formatFileSize(asset.sizeBytes)})`,
                  )
                  .join(", ")}
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

        <dl className="grid gap-2 border-b border-border px-4 py-4 text-sm sm:grid-cols-2">
          <div className="min-w-0 rounded-md bg-background px-3 py-2.5">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Recipient
            </dt>
            <dd className="mt-1 break-words font-semibold">
              {fullName.trim() || "Name not provided"}
            </dd>
          </div>
          <div className="min-w-0 rounded-md bg-background px-3 py-2.5">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              WhatsApp destination
            </dt>
            <dd className="mt-1 break-words font-semibold tabular-nums text-success">
              {destination ?? "Enter an international number"}
            </dd>
          </div>
        </dl>

        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Exact WhatsApp message
          </p>
          <div className="mt-1.5 min-h-20 whitespace-pre-wrap break-words rounded-md border border-border bg-background px-3 py-3 text-sm leading-6">
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

          <label className="mt-4 flex min-w-0 items-start gap-2.5 text-xs leading-5">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={!ready || Boolean(result)}
              className="mt-0.5 h-4 w-4 flex-none accent-[var(--success)]"
            />
            <span className="min-w-0">
              I checked the recipient number and the exact message above.
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
                  ? "Try sending again"
                  : "Send WhatsApp"}
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 border-t border-border bg-background/60 px-4 py-2.5 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheck
            className="mt-0.5 h-3.5 w-3.5 flex-none text-success"
            aria-hidden
          />
          <span className="min-w-0">
            Opt-outs, confirmation and message auditing stay active for every
            number.
          </span>
        </div>
      </section>
    </form>
  );
}
