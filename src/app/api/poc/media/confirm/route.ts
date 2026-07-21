import { NextResponse } from "next/server";
import { MEDIA_BUCKET, kindFor, publicUrl, validateMedia } from "@/lib/poc/media";

export const dynamic = "force-dynamic";

/**
 * Step 3 of an upload: catalogue a file the browser has just PUT into storage.
 *
 * The object is verified to actually exist, and its real size and Content-Type are read
 * back from storage rather than trusted from the request — a client could otherwise
 * register a row pointing at nothing, or lie about the size to slip past the WhatsApp
 * limits enforced when the URL was signed.
 */
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    return NextResponse.json({ ok: false, error: { message: "Supabase env not set." } }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    path?: unknown;
    filename?: unknown;
    caption?: unknown;
  };
  const path = typeof body.path === "string" ? body.path : "";
  const filename = typeof body.filename === "string" ? body.filename : "";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";

  if (!path || !filename || path.includes("..")) {
    return NextResponse.json({ ok: false, error: { message: "Bad upload reference." } }, { status: 400 });
  }

  const url = publicUrl(supabaseUrl, path);

  // Confirm it landed, and take size/type from storage itself.
  const head = await fetch(url, { method: "HEAD", cache: "no-store" });
  if (!head.ok) {
    return NextResponse.json(
      { ok: false, error: { message: "Upload did not complete — try again." } },
      { status: 400 },
    );
  }
  const mimeType = head.headers.get("content-type") ?? "application/octet-stream";
  const sizeBytes = Number(head.headers.get("content-length") ?? 0);

  const problem = validateMedia(mimeType, sizeBytes);
  if (problem) {
    // Remove the object so a rejected file can't linger in the bucket unreferenced.
    await fetch(`${supabaseUrl}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: { message: problem.message } }, { status: 400 });
  }

  const insert = await fetch(`${supabaseUrl}/rest/v1/media_assets`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      kind: kindFor(mimeType) ?? "document",
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
  return NextResponse.json({ ok: true, data: { id: row?.id, url, filename, sizeBytes } });
}
