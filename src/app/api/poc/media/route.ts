import { NextResponse } from "next/server";
import { listMedia } from "@/lib/poc/media";

export const dynamic = "force-dynamic";

/**
 * The vault contents, for the attach picker.
 *
 * Uploading does NOT happen here. Files go browser -> Supabase Storage directly via a
 * signed URL (see ./sign and ./confirm): request bodies through this app are capped at
 * 10 MB locally once middleware is in play and ~4.5 MB on Vercel serverless, so any
 * route that proxied the bytes would be broken for video by construction.
 */
export async function GET() {
  const assets = await listMedia();
  return NextResponse.json({ ok: true, data: { assets } });
}
