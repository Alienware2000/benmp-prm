/**
 * Media vault — the pictures, videos and documents staff can attach to a message.
 *
 * Why a vault at all: WhatsApp providers do NOT accept an upload on the send call. They
 * are given a URL and fetch the file themselves, so every attachment must already live
 * somewhere publicly reachable before a send can reference it. Supabase Storage gives us
 * that URL; `media_assets` is the catalogue staff pick from.
 *
 * Validation lives here rather than at the UI so a bad file is rejected once, at upload,
 * instead of failing per-recipient mid-broadcast.
 */

import type { Fetcher } from "./db";
import { supabaseRestFetcher } from "./db";

/** Storage bucket holding every attachment. Public-read: the provider must be able to GET it. */
export const MEDIA_BUCKET = "media";

export type MediaKind = "image" | "video" | "audio" | "document";

/**
 * WhatsApp size ceilings, in bytes.
 *
 * 16 MB is the per-message limit; images are capped lower at 5 MB. Twilio's generic
 * accepted-types page quotes 20 MB, but that is not WhatsApp-specific — the tighter
 * number is the one that governs, so we enforce it and reject early.
 */
export const MAX_BYTES_IMAGE = 5 * 1024 * 1024;
export const MAX_BYTES_MESSAGE = 16 * 1024 * 1024;

/**
 * MIME types worth allowing for a partner broadcast.
 *
 * Deliberately narrower than the provider's full list: `image/webp` is accepted by
 * WhatsApp only as a STICKER (with extra requirements), so allowing it here would let
 * staff upload a photo that arrives as a sticker or not at all. Convert to JPEG instead.
 */
const ALLOWED: Record<string, MediaKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "video/mp4": "video",
  "video/3gpp": "video",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/amr": "audio",
  "application/pdf": "document",
};

export function kindFor(mimeType: string): MediaKind | null {
  return ALLOWED[mimeType.toLowerCase().trim()] ?? null;
}

export type MediaProblem =
  | { code: "unsupported_type"; message: string }
  | { code: "too_large"; message: string }
  | { code: "empty"; message: string };

/**
 * Reject anything WhatsApp would refuse, with a message a staff member can act on.
 * Returns null when the file is fine.
 */
export function validateMedia(mimeType: string, sizeBytes: number): MediaProblem | null {
  const kind = kindFor(mimeType);
  if (!kind) {
    const hint =
      mimeType.toLowerCase().includes("webp")
        ? " WebP is only allowed as a sticker on WhatsApp — save it as JPEG or PNG."
        : "";
    return { code: "unsupported_type", message: `${mimeType} can't be sent on WhatsApp.${hint}` };
  }
  if (sizeBytes <= 0) return { code: "empty", message: "File is empty." };

  const limit = kind === "image" ? MAX_BYTES_IMAGE : MAX_BYTES_MESSAGE;
  if (sizeBytes > limit) {
    return {
      code: "too_large",
      message: `${formatBytes(sizeBytes)} is over the ${formatBytes(limit)} WhatsApp limit for ${kind === "image" ? "images" : "media"}. Compress it and try again.`,
    };
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Storage object path for an upload. Namespaced by kind and prefixed with a caller-supplied
 * token so two files with the same name can't overwrite each other.
 */
export function storagePath(kind: MediaKind, filename: string, token: string): string {
  const safe = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase();
  return `${kind}/${token}-${safe || "file"}`;
}

/** Public URL for a stored object — this is what the provider fetches. */
export function publicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

export type DbMediaAsset = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number | string;
  kind: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  created_at: string;
};

export type MediaAsset = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: MediaKind;
  url: string;
  caption: string | null;
  createdAt: string;
};

export function mapMediaAssets(rows: DbMediaAsset[]): MediaAsset[] {
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    kind: (kindFor(r.mime_type) ?? "document") as MediaKind,
    url: r.public_url,
    caption: r.caption,
    createdAt: r.created_at,
  }));
}

export async function listMedia(fetcher: Fetcher = supabaseRestFetcher()): Promise<MediaAsset[]> {
  const rows = await fetcher<DbMediaAsset>(
    "media_assets?select=id,filename,mime_type,size_bytes,kind,storage_path,public_url,caption,created_at&order=created_at.desc&limit=200",
  );
  return mapMediaAssets(rows);
}

/** Look up one asset — the send path resolves the URL server-side rather than trusting the client. */
export async function loadMediaAsset(
  id: string,
  fetcher: Fetcher = supabaseRestFetcher(),
): Promise<MediaAsset | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await fetcher<DbMediaAsset>(
    `media_assets?select=id,filename,mime_type,size_bytes,kind,storage_path,public_url,caption,created_at&id=eq.${id}&limit=1`,
  );
  return mapMediaAssets(rows)[0] ?? null;
}
