import { describe, expect, it } from "vitest";
import {
  MAX_BYTES_IMAGE,
  MAX_BYTES_MESSAGE,
  formatBytes,
  kindFor,
  mapMediaAssets,
  publicUrl,
  storagePath,
  validateMedia,
  type DbMediaAsset,
} from "./media";

describe("kindFor", () => {
  it("classifies the types we broadcast", () => {
    expect(kindFor("image/jpeg")).toBe("image");
    expect(kindFor("video/mp4")).toBe("video");
    expect(kindFor("audio/mpeg")).toBe("audio");
    expect(kindFor("application/pdf")).toBe("document");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(kindFor("  IMAGE/JPEG ")).toBe("image");
  });

  it("rejects webp — WhatsApp only takes it as a sticker", () => {
    expect(kindFor("image/webp")).toBeNull();
  });

  it("rejects anything else", () => {
    expect(kindFor("application/zip")).toBeNull();
    expect(kindFor("")).toBeNull();
  });
});

describe("validateMedia", () => {
  it("accepts a normal photo and video", () => {
    expect(validateMedia("image/jpeg", 208 * 1024)).toBeNull();
    expect(validateMedia("video/mp4", 12 * 1024 * 1024)).toBeNull();
  });

  it("enforces the tighter 5 MB image cap", () => {
    expect(validateMedia("image/jpeg", MAX_BYTES_IMAGE)).toBeNull();
    const p = validateMedia("image/jpeg", MAX_BYTES_IMAGE + 1);
    expect(p?.code).toBe("too_large");
    expect(p?.message).toContain("5.0 MB");
  });

  it("enforces the 16 MB message cap for video", () => {
    expect(validateMedia("video/mp4", MAX_BYTES_MESSAGE)).toBeNull();
    // The real HJC Bangui sample is 18 MB — it must be rejected before a broadcast starts.
    const p = validateMedia("video/mp4", 18 * 1024 * 1024);
    expect(p?.code).toBe("too_large");
    expect(p?.message).toContain("Compress it");
  });

  it("explains the webp/sticker trap instead of just refusing", () => {
    const p = validateMedia("image/webp", 100 * 1024);
    expect(p?.code).toBe("unsupported_type");
    expect(p?.message).toContain("sticker");
    expect(p?.message).toContain("JPEG");
  });

  it("rejects an empty file", () => {
    expect(validateMedia("image/jpeg", 0)?.code).toBe("empty");
  });
});

describe("formatBytes", () => {
  it("reads the way a person would say it", () => {
    expect(formatBytes(208 * 1024)).toBe("208 KB");
    expect(formatBytes(18 * 1024 * 1024)).toBe("18.0 MB");
    expect(formatBytes(512)).toBe("512 B");
  });
});

describe("storagePath", () => {
  it("namespaces by kind and keeps files with the same name apart", () => {
    expect(storagePath("image", "HJC Nkayi.jpg", "abc123")).toBe("image/abc123-hjc-nkayi.jpg");
    expect(storagePath("video", "HJC Bangui.MP4", "def456")).toBe("video/def456-hjc-bangui.mp4");
  });

  it("strips characters that would break a URL path", () => {
    expect(storagePath("image", "a b/c?d#e.jpg", "t")).toBe("image/t-a-b-c-d-e.jpg");
  });

  it("survives an unusable filename", () => {
    expect(storagePath("document", "///", "t")).toBe("document/t-file");
  });
});

describe("publicUrl", () => {
  it("builds the URL the provider will fetch", () => {
    expect(publicUrl("https://x.supabase.co", "image/a.jpg")).toBe(
      "https://x.supabase.co/storage/v1/object/public/media/image/a.jpg",
    );
  });

  it("tolerates a trailing slash on the project URL", () => {
    expect(publicUrl("https://x.supabase.co/", "image/a.jpg")).toContain("/public/media/image/a.jpg");
  });
});

describe("mapMediaAssets", () => {
  const rows: DbMediaAsset[] = [
    {
      id: "1",
      filename: "HJC Nkayi.jpg",
      mime_type: "image/jpeg",
      size_bytes: "212992",
      kind: "image",
      storage_path: "image/abc-hjc-nkayi.jpg",
      public_url: "https://x.supabase.co/storage/v1/object/public/media/image/abc-hjc-nkayi.jpg",
      caption: "Healing Jesus Campaign, Nkayi",
      created_at: "2026-07-21T09:00:00Z",
    },
  ];

  it("maps a row to the shape the picker renders", () => {
    const [a] = mapMediaAssets(rows);
    expect(a.kind).toBe("image");
    expect(a.sizeBytes).toBe(212992);
    expect(a.url).toContain("/public/media/");
    expect(a.caption).toBe("Healing Jesus Campaign, Nkayi");
  });
});
