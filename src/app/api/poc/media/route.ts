import { NextResponse } from "next/server";
import { getMessagingAdapter } from "@/lib/messaging";
import { attachmentExceedsProviderLimit } from "@/lib/messaging/media-policy";
import { deleteMediaAsset, listMedia } from "@/lib/poc/media";

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
  const provider = getMessagingAdapter().provider;
  const available = assets.filter(
    (asset) => !attachmentExceedsProviderLimit(provider, asset.sizeBytes),
  );
  const incompatible = assets.filter((asset) =>
    attachmentExceedsProviderLimit(provider, asset.sizeBytes),
  );

  return NextResponse.json({
    ok: true,
    data: { assets: available, incompatible, provider },
  });
}

/** Permanently remove one vault asset. The POC password gate protects this route. */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  try {
    const result = await deleteMediaAsset(id);
    if (!result.found) {
      return NextResponse.json(
        { ok: false, error: { message: "Attachment not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "The attachment could not be deleted.",
        },
      },
      { status: 502 },
    );
  }
}
