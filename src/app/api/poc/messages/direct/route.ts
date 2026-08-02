import { NextResponse } from "next/server";
import { z } from "zod";
import { firstName, type PlannedMessage } from "@/lib/messages";
import { getMessagingAdapter } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import {
  findSentMessageByPartnerRef,
  loadOptOuts,
  recordSentMessages,
  toSentMessageRows,
} from "@/lib/poc/db";
import { loadMediaAsset, validateMediaForProvider } from "@/lib/poc/media";
import { parseAllowlist, sendPlanned } from "@/lib/send";
import { messagingRuntimeConfiguration } from "@/lib/messaging/runtime-configuration";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  idempotencyKey: z.uuid(),
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(8).max(30),
  message: z.string().trim().min(1).max(1000),
  mediaAssetId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Check the destination number and write a message first.",
        },
      },
      { status: 400 },
    );
  }

  const to = normalizePhone(parsed.data.phone);
  if (!to) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "Enter the full international WhatsApp number." },
      },
      { status: 400 },
    );
  }

  const body = parsed.data.message;
  const partnerRef = `direct:${parsed.data.idempotencyKey}:${to}`;
  const previous = await findSentMessageByPartnerRef(partnerRef);

  if (
    previous &&
    (previous.status === "queued" || previous.status === "sent")
  ) {
    if (previous.body !== body) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Start a new message before changing one already sent.",
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json({
      ok: true,
      data: {
        to,
        body,
        audited: true,
        idempotentReplay: true,
        outcome: {
          status: previous.status,
          providerMessageId: previous.providerMessageId,
        },
      },
    });
  }

  const messaging = await messagingRuntimeConfiguration();
  if (!messaging.ready) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message:
            messaging.note ??
            "WhatsApp sending is unavailable. Nothing was sent.",
        },
      },
      { status: 503 },
    );
  }

  const media = parsed.data.mediaAssetId
    ? await loadMediaAsset(parsed.data.mediaAssetId)
    : null;
  if (parsed.data.mediaAssetId && !media) {
    return NextResponse.json(
      { ok: false, error: { message: "Attachment not found." } },
      { status: 404 },
    );
  }

  const adapter = getMessagingAdapter();
  const mediaProblem = media
    ? validateMediaForProvider(
        adapter.provider,
        media.mimeType,
        media.sizeBytes,
      )
    : null;
  if (mediaProblem) {
    return NextResponse.json(
      { ok: false, error: { message: mediaProblem.message } },
      { status: 400 },
    );
  }

  const planned: PlannedMessage = {
    kind: "direct",
    to,
    name: firstName(parsed.data.fullName ?? ""),
    body,
    partnerRef,
    channel: "whatsapp",
    category: "utility",
    sendable: true,
    ...(media
      ? {
          mediaUrl: media.url,
          mediaType: media.mimeType,
          mediaFilename: media.filename,
        }
      : {}),
  };
  const report = await sendPlanned([planned], {
    adapter,
    optedOut: await loadOptOuts(),
    allowlist: parseAllowlist(process.env.BENMP_SEND_ALLOWLIST),
  });
  const outcome = report.outcomes[0];
  const audited = await recordSentMessages(
    toSentMessageRows([planned], report.outcomes),
  );

  if (outcome.status === "failed" || outcome.status === "skipped") {
    return NextResponse.json(
      {
        ok: false,
        error: { message: outcome.reason ?? "The message was not accepted." },
      },
      { status: outcome.status === "skipped" ? 409 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      to,
      body,
      audited,
      idempotentReplay: false,
      outcome,
    },
  });
}
