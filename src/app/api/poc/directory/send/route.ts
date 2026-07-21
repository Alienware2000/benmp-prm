import { NextResponse } from "next/server";
import {
  loadOptOuts,
  recordSentMessages,
  toSentMessageRows,
} from "@/lib/poc/db";
import { loadPartnersByIds } from "@/lib/poc/directory";
import {
  buildDirectMessages,
  validateTemplate,
} from "@/lib/poc/direct-message";
import { summarizePlan } from "@/lib/poc/dispatch";
import { loadMediaAsset } from "@/lib/poc/media";
import { parseAllowlist, sendPlanned } from "@/lib/send";
import { getMessagingAdapter } from "@/lib/messaging";

export const dynamic = "force-dynamic";

const MAX_RECIPIENTS = 200;

/**
 * Preview or send a staff-composed message to specific partners from the directory.
 *
 * POST { partnerIds: string[], message: string, confirm?: boolean }
 *  - confirm falsy (default): PREVIEW — render the exact per-recipient bodies and return
 *    a summary. Nothing is dispatched.
 *  - confirm true: SEND — dispatch through the configured adapter.
 *
 * Sending is always on explicit demand: there is no scheduled or automatic path into this
 * route, and a preview never sends.
 *
 * The selected partners are re-read from the database by id rather than trusted from the
 * request body, so a tampered payload cannot redirect a message to an arbitrary number.
 * The same gates as the planned queues apply: opt_outs are skipped, and when
 * BENMP_SEND_ALLOWLIST is set only those numbers are dispatched. Every attempt is audited
 * to sent_messages.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    partnerIds?: unknown;
    message?: unknown;
    confirm?: unknown;
    mediaAssetId?: unknown;
  };

  const partnerIds = Array.isArray(body.partnerIds)
    ? body.partnerIds.filter((id): id is string => typeof id === "string")
    : [];
  const message = typeof body.message === "string" ? body.message : "";
  const confirm = body.confirm === true;
  const mediaAssetId =
    typeof body.mediaAssetId === "string" ? body.mediaAssetId : null;

  if (partnerIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: { message: "Select at least one partner." } },
      { status: 400 },
    );
  }
  if (partnerIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: `Select at most ${MAX_RECIPIENTS} partners at a time.`,
        },
      },
      { status: 400 },
    );
  }

  const problem = validateTemplate(message);
  if (problem === "empty") {
    return NextResponse.json(
      { ok: false, error: { message: "Write a message first." } },
      { status: 400 },
    );
  }
  if (problem === "too_long") {
    return NextResponse.json(
      { ok: false, error: { message: "Message is too long." } },
      { status: 400 },
    );
  }

  const partners = await loadPartnersByIds(partnerIds);
  if (partners.length === 0) {
    return NextResponse.json(
      { ok: false, error: { message: "No matching partners found." } },
      { status: 404 },
    );
  }

  // Resolve the attachment from its id server-side — the client never supplies the URL a
  // provider will fetch, so a tampered payload can't make us broadcast an arbitrary file.
  let media: Awaited<ReturnType<typeof loadMediaAsset>> = null;
  if (mediaAssetId) {
    const asset = await loadMediaAsset(mediaAssetId);
    if (!asset) {
      return NextResponse.json(
        { ok: false, error: { message: "Attachment not found." } },
        { status: 404 },
      );
    }
    media = asset;
  }

  const optedOut = await loadOptOuts();
  const messages = buildDirectMessages(partners, message, media ?? undefined);

  if (!confirm) {
    return NextResponse.json({
      ok: true,
      data: {
        mode: "preview",
        // Show every recipient: the directory selection is small and deliberate, unlike
        // the bulk queues where only a sample is useful.
        summary: summarizePlan(messages, {
          optedOut,
          sampleSize: messages.length,
        }),
      },
    });
  }

  const report = await sendPlanned(messages, {
    adapter: getMessagingAdapter(),
    optedOut,
    allowlist: parseAllowlist(process.env.BENMP_SEND_ALLOWLIST),
  });
  const audited = await recordSentMessages(
    toSentMessageRows(messages, report.outcomes),
  );

  return NextResponse.json({
    ok: true,
    data: { mode: "sent", report, audited },
  });
}
