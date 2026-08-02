"use client";

import {
  FileText,
  ImageIcon,
  LoaderCircle,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FeedbackNotice } from "@/components/feedback-notice";

export type MessageMediaAsset = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "video" | "audio" | "document";
  url: string;
  caption: string | null;
};

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function assetLabel(asset: MessageMediaAsset): string {
  if (asset.kind === "image") return "Image";
  if (asset.kind === "video") return "Video";
  if (asset.kind === "audio") return "Audio";
  return "File";
}

export function MessageAttachmentField({
  value,
  onChange,
  onAssetChange,
  onError,
  id = "message-attachment",
}: {
  value: string;
  onChange: (id: string) => void;
  onAssetChange?: (asset: MessageMediaAsset | null) => void;
  onError?: (message: string) => void;
  id?: string;
}) {
  const [assets, setAssets] = useState<MessageMediaAsset[]>([]);
  const [incompatible, setIncompatible] = useState<MessageMediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const attached = useMemo(
    () => assets.find((asset) => asset.id === value) ?? null,
    [assets, value],
  );

  useEffect(() => {
    fetch("/api/poc/media")
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.ok) return;
        setAssets(payload.data?.assets ?? []);
        setIncompatible(payload.data?.incompatible ?? []);
      })
      .catch(() => onError?.("The attachment library could not be loaded."));
  }, [onError]);

  useEffect(() => {
    onAssetChange?.(attached);
  }, [attached, onAssetChange]);

  async function refreshAssets(selectedId?: string) {
    const payload = await fetch("/api/poc/media").then((response) =>
      response.json(),
    );
    setAssets(payload?.data?.assets ?? []);
    setIncompatible(payload?.data?.incompatible ?? []);
    if (selectedId) onChange(selectedId);
  }

  async function upload(file: File) {
    setUploading(true);
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
        onError?.(
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
        onError?.(
          "The attachment could not be transferred to the media vault.",
        );
        return;
      }

      const confirmed = await fetch("/api/poc/media/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: signed.data.path,
          filename: file.name,
        }),
      }).then((response) => response.json());
      if (!confirmed.ok) {
        onError?.(
          confirmed.error?.message ??
            "The attachment could not be added to the media vault.",
        );
        return;
      }
      await refreshAssets(confirmed.data.id);
    } catch {
      onError?.("The attachment upload was interrupted. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteAssets(doomed: MessageMediaAsset[]) {
    if (
      deleting ||
      doomed.length === 0 ||
      !window.confirm(
        `Permanently delete ${doomed.length === 1 ? doomed[0].filename : `${doomed.length} unusable attachments`} from the BENMP media library?`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const results = await Promise.all(
        doomed.map(async (asset) => {
          const response = await fetch(
            `/api/poc/media?id=${encodeURIComponent(asset.id)}`,
            { method: "DELETE" },
          );
          return { asset, ok: response.ok };
        }),
      );
      const failed = results.filter((result) => !result.ok);
      if (failed.length > 0) {
        onError?.(
          `${failed.length} attachment${failed.length === 1 ? "" : "s"} could not be deleted.`,
        );
      }
      if (results.some((result) => result.ok && result.asset.id === value)) {
        onChange("");
      }
      await refreshAssets();
    } catch {
      onError?.("The attachment could not be deleted. Nothing else changed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-1.5 text-xs font-semibold">
      <label htmlFor={id}>Attachment</label>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 min-w-0 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-success"
        >
          <option value="">No attachment</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {assetLabel(asset)} — {asset.filename}
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
        <div className="mt-1 overflow-hidden rounded-md border border-border bg-background font-normal">
          {attached.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attached.url}
              alt={attached.caption ?? attached.filename}
              className="max-h-48 w-full object-cover"
            />
          ) : attached.kind === "video" ? (
            <video
              src={attached.url}
              controls
              preload="metadata"
              className="max-h-48 w-full bg-black object-contain"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            {attached.kind === "image" ? (
              <ImageIcon className="h-4 w-4 flex-none" aria-hidden />
            ) : attached.kind === "video" ? (
              <Video className="h-4 w-4 flex-none" aria-hidden />
            ) : (
              <FileText className="h-4 w-4 flex-none" aria-hidden />
            )}
            <span className="mr-auto min-w-0 truncate text-muted-foreground">
              <b className="text-foreground">{attached.filename}</b> ·{" "}
              {formatFileSize(attached.sizeBytes)}
            </span>
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex h-8 items-center gap-1 rounded border border-border bg-surface px-2.5 font-semibold hover:bg-background"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Remove
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void deleteAssets([attached])}
              className="inline-flex h-8 items-center gap-1 rounded border border-red-200 bg-white px-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete file
            </button>
          </div>
        </div>
      )}

      {incompatible.length > 0 && (
        <FeedbackNotice
          tone="warning"
          className="mt-1 font-normal"
          title={`${incompatible.length} unusable attachment${incompatible.length === 1 ? "" : "s"} hidden`}
          action={{
            label: deleting
              ? "Deleting..."
              : `Delete ${incompatible.length === 1 ? "file" : "files"}`,
            onClick: () => void deleteAssets(incompatible),
          }}
          supportingText="New uploads are checked against the active WhatsApp provider."
        >
          {incompatible
            .map(
              (asset) =>
                `${asset.filename} (${formatFileSize(asset.sizeBytes)})`,
            )
            .join(", ")}
        </FeedbackNotice>
      )}
    </div>
  );
}
