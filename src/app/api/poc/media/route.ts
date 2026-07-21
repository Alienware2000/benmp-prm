import { NextResponse } from "next/server";
import {
  MAX_BYTES_MESSAGE,
  MEDIA_BUCKET,
  formatBytes,
  kindFor,
  listMedia,
  publicUrl,
  storagePath,
  validateMedia,
} from "@/lib/poc/media";

export const dynamic = "force-dynamic";

/** GET — the vault contents, for the attach picker. */
export async function GET() {
  const assets = await listMedia();
  return NextResponse.json({ ok: true, data: { assets } });
}

/**
 * POST — upload one file into the vault.
 *
 * multipart/form-data: `file` (required), `caption` (optional).
 *
 * Validation happens here, not in the browser: a file WhatsApp would refuse must be
 * rejected once at upload rather than failing per-recipient partway through a broadcast.
 * The bytes go to Supabase Storage and the row records the public URL the provider will
 * later fetch.
 */
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    return NextResponse.json({ ok: false, error: { message: "Supabase env not set." } }, { status: 500 });
  }

  /*
   * Check the declared size BEFORE parsing the body. An over-limit upload makes
   * req.formData() throw, which previously surfaced as the nonsense message
   * "No file uploaded" — the one case where the user most needs to be told the real
   * reason. Content-Length includes multipart overhead, so this is a coarse gate; the
   * exact per-kind limit is still enforced by validateMedia() below.
   */
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES_MESSAGE) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: `${formatBytes(declared)} is over the ${formatBytes(MAX_BYTES_MESSAGE)} WhatsApp limit. Compress it and try again.`,
        },
      },
      { status: 413 },
    );
  }

  let form: FormData | null = null;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "Could not read the upload — the file may be too large." } },
      { status: 413 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: { message: "No file uploaded." } }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const problem = validateMedia(mimeType, file.size);
  if (problem) {
    return NextResponse.json({ ok: false, error: { message: problem.message } }, { status: 400 });
  }

  const kind = kindFor(mimeType)!;
  const token = crypto.randomUUID().slice(0, 8);
  const path = storagePath(kind, file.name, token);

  const upload = await fetch(`${supabaseUrl}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": mimeType,
      "x-upsert": "false",
    },
    body: await file.arrayBuffer(),
  });
  if (!upload.ok) {
    return NextResponse.json(
      { ok: false, error: { message: `Upload failed: ${upload.status} ${await upload.text()}` } },
      { status: 502 },
    );
  }

  const url = publicUrl(supabaseUrl, path);
  const caption = typeof form.get("caption") === "string" ? String(form.get("caption")).trim() : null;

  const insert = await fetch(`${supabaseUrl}/rest/v1/media_assets`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      filename: file.name,
      mime_type: mimeType,
      size_bytes: file.size,
      kind,
      storage_path: path,
      public_url: url,
      caption: caption || null,
    }),
  });
  if (!insert.ok) {
    return NextResponse.json(
      { ok: false, error: { message: `Catalogue write failed: ${insert.status} ${await insert.text()}` } },
      { status: 502 },
    );
  }

  const [row] = (await insert.json()) as Array<{ id: string }>;
  return NextResponse.json({ ok: true, data: { id: row?.id, url, kind, filename: file.name } });
}
