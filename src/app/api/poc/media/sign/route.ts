import { NextResponse } from "next/server";
import { MEDIA_BUCKET, kindFor, storagePath, validateMedia } from "@/lib/poc/media";

export const dynamic = "force-dynamic";

/**
 * Step 1 of an upload: hand the browser a short-lived signed URL to PUT the file
 * straight into Supabase Storage.
 *
 * Why not just POST the file to this app? Request bodies through a Next.js app are
 * capped — 10 MB locally once middleware is in play, and ~4.5 MB for serverless
 * functions on Vercel. A 12 MB video can never make it through, so any route that
 * proxies the bytes is broken for video by construction. Signing here keeps the file
 * off the app server entirely; only small JSON crosses this boundary.
 *
 * Validation still happens server-side: the URL is only signed for a filename, type and
 * size we would accept, so the browser can't invent its own limits.
 */
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    return NextResponse.json({ ok: false, error: { message: "Supabase env not set." } }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    filename?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
  };
  const filename = typeof body.filename === "string" ? body.filename : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (!filename) {
    return NextResponse.json({ ok: false, error: { message: "No file name." } }, { status: 400 });
  }

  const problem = validateMedia(mimeType, sizeBytes);
  if (problem) {
    return NextResponse.json({ ok: false, error: { message: problem.message } }, { status: 400 });
  }

  const kind = kindFor(mimeType)!;
  const path = storagePath(kind, filename, crypto.randomUUID().slice(0, 8));

  const signed = await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/${MEDIA_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!signed.ok) {
    return NextResponse.json(
      { ok: false, error: { message: `Could not prepare upload: ${signed.status} ${await signed.text()}` } },
      { status: 502 },
    );
  }

  // Supabase returns a relative URL like "/object/upload/sign/media/<path>?token=..."
  const { url } = (await signed.json()) as { url: string };

  return NextResponse.json({
    ok: true,
    data: { uploadUrl: `${supabaseUrl}/storage/v1${url}`, path, kind },
  });
}
