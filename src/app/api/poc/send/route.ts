import { NextResponse } from "next/server";
import {
  loadAcceptedSentMessageKeys,
  loadOptOuts,
  recordSentMessages,
  sentMessageKey,
  toSentMessageRows,
} from "@/lib/poc/db";
import {
  filterPayersByAmount,
  planMessages,
  templatesFromDraft,
  type PlannedMessage,
} from "@/lib/messages";
import {
  dedupeAudiencePartners,
  filterAudienceByAmount,
  isAudienceKey,
  reconciliationAudiencePartners,
  type AudienceKey,
} from "@/lib/poc/audiences";
import {
  buildDirectMessages,
  validateTemplate,
} from "@/lib/poc/direct-message";
import { loadAllDirectoryPartnersCached } from "@/lib/poc/directory";
import { summarizePlan, filterByKind, type PlanKind } from "@/lib/poc/dispatch";
import { loadMediaAsset, validateMediaForProvider } from "@/lib/poc/media";
import { sendPlanned, parseAllowlist } from "@/lib/send";
import { getMessagingAdapter } from "@/lib/messaging";
import {
  loadReconciliationCached,
  messagingRuntimeConfigurationCached,
} from "@/lib/poc/cached-data";
import { filterReconciliationByPeriod } from "@/lib/poc/reporting-period";

export const dynamic = "force-dynamic";

/** A synchronous request must never try to dispatch an unbounded global broadcast. */
const MAX_IMMEDIATE_RECIPIENTS = 2_000;

function withMedia(
  messages: PlannedMessage[],
  media: Awaited<ReturnType<typeof loadMediaAsset>>,
): PlannedMessage[] {
  if (!media) return messages;
  return messages.map((message) => ({
    ...message,
    mediaUrl: media.url,
    mediaType: media.mimeType,
    mediaFilename: media.filename,
  }));
}

/**
 * Preview or send this period's thank-yous and reminders.
 *
 * POST { confirm?, audience?, kind?, message?, minAmountMinor?, maxAmountMinor?, mediaAssetId? }
 *  - confirm falsy (default): PREVIEW — plan the messages and return a summary, no sending.
 *  - confirm true: SEND — dispatch through the configured messaging adapter and return
 *    the send report.
 *  - kind (default "all"): restrict the preview/send to one queue so the Message Center
 *    can operate thank-yous and reminders independently.
 *
 * Consent + safety gates on every send: Supabase opt_outs are skipped (also surfaced in
 * the preview summary), and when BENMP_SEND_ALLOWLIST is set only those numbers are
 * dispatched — the training wheels for going live with real sends.
 *
 * Reminders are event-driven: only planned when the due date has passed. For the POC the
 * period's due date is treated as already passed.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    confirm?: unknown;
    kind?: unknown;
    message?: unknown;
    minAmountMinor?: unknown;
    maxAmountMinor?: unknown;
    audience?: unknown;
    mediaAssetId?: unknown;
    from?: unknown;
    to?: unknown;
  };
  const confirm = body.confirm === true;
  const kind: PlanKind =
    body.kind === "thank_you" || body.kind === "reminder" ? body.kind : "all";
  const audience: AudienceKey | null = isAudienceKey(body.audience)
    ? body.audience
    : kind === "thank_you"
      ? "paid"
      : kind === "reminder"
        ? "unpaid"
        : null;
  const message = typeof body.message === "string" ? body.message : "";
  const mediaAssetId =
    typeof body.mediaAssetId === "string" ? body.mediaAssetId : null;
  const dateValue = (value: unknown): string =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  const from = dateValue(body.from);
  const to = dateValue(body.to);
  const requiresStaffDraft =
    audience !== null && !["paid", "unpaid"].includes(audience);
  const messageProblem =
    message || requiresStaffDraft ? validateTemplate(message) : null;
  if (messageProblem) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message:
            messageProblem === "too_long"
              ? "Message is too long."
              : "Write a message first.",
        },
      },
      { status: 400 },
    );
  }

  const parseAmount = (value: unknown): number | null => {
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
  };
  const minAmountMinor = parseAmount(body.minAmountMinor);
  const maxAmountMinor = parseAmount(body.maxAmountMinor);
  if (
    minAmountMinor !== null &&
    maxAmountMinor !== null &&
    minAmountMinor > maxAmountMinor
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "Minimum amount cannot be greater than maximum." },
      },
      { status: 400 },
    );
  }

  const asOf = new Date().toISOString().slice(0, 10);
  const adapter = getMessagingAdapter();
  const [completeResult, optedOut, acceptedThankYous, standingPartners, media] =
    await Promise.all([
      loadReconciliationCached(),
      loadOptOuts(),
      audience === "paid" || (audience === null && kind !== "reminder")
        ? loadAcceptedSentMessageKeys("thank_you")
        : Promise.resolve(new Set<string>()),
      audience === "everyone"
        ? loadAllDirectoryPartnersCached()
        : Promise.resolve([]),
      mediaAssetId ? loadMediaAsset(mediaAssetId) : Promise.resolve(null),
    ]);
  const result = filterReconciliationByPeriod(completeResult, { from, to });

  if (mediaAssetId && !media) {
    return NextResponse.json(
      { ok: false, error: { message: "Attachment not found." } },
      { status: 404 },
    );
  }
  if (media) {
    const mediaProblem = validateMediaForProvider(
      adapter.provider,
      media.mimeType,
      media.sizeBytes,
    );
    if (mediaProblem) {
      return NextResponse.json(
        { ok: false, error: { message: mediaProblem.message } },
        { status: 400 },
      );
    }
  }

  const amountRange = {
    ...(minAmountMinor !== null ? { minAmountMinor } : {}),
    ...(maxAmountMinor !== null ? { maxAmountMinor } : {}),
  };
  let planned: PlannedMessage[];

  if (audience === "everyone") {
    const partners = filterAudienceByAmount(
      dedupeAudiencePartners(standingPartners),
      amountRange,
    );
    planned = buildDirectMessages(partners, message, media ?? undefined);
  } else if (
    audience === "top" ||
    audience === "consistent" ||
    audience === "new"
  ) {
    const partners = filterAudienceByAmount(
      reconciliationAudiencePartners(result, audience),
      amountRange,
    );
    planned = buildDirectMessages(partners, message, media ?? undefined);
  } else {
    const filteredResult =
      audience === "paid" &&
      (minAmountMinor !== null || maxAmountMinor !== null)
        ? filterPayersByAmount(result, amountRange)
        : result;
    const planKind: PlanKind =
      audience === "paid"
        ? "thank_you"
        : audience === "unpaid"
          ? "reminder"
          : kind;
    planned = withMedia(
      filterByKind(
        planMessages(filteredResult, {
          asOf,
          dueDate: "1970-01-01",
          ...(message ? { templates: templatesFromDraft(message) } : {}),
        }),
        planKind,
      ),
      media,
    );
  }

  const dedupeThankYous = audience === "paid" || audience === null;
  const messages = planned.filter(
    (plannedMessage) =>
      !dedupeThankYous ||
      plannedMessage.kind !== "thank_you" ||
      !plannedMessage.to ||
      !acceptedThankYous.has(
        sentMessageKey(plannedMessage.to, plannedMessage.body),
      ),
  );
  const alreadySent = planned.length - messages.length;
  const summary = {
    ...summarizePlan(messages, { optedOut }),
    alreadySent,
    sendLimit: MAX_IMMEDIATE_RECIPIENTS,
    overSendLimit:
      messages.filter((plannedMessage) => plannedMessage.sendable).length >
      MAX_IMMEDIATE_RECIPIENTS,
  };

  if (!confirm) {
    return NextResponse.json({
      ok: true,
      data: {
        mode: "preview",
        summary,
      },
    });
  }

  if (summary.overSendLimit) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: `This group has ${summary.sendable.toLocaleString("en-US")} sendable people. One immediate send is limited to ${MAX_IMMEDIATE_RECIPIENTS.toLocaleString("en-US")}; choose a more specific group before sending.`,
        },
      },
      { status: 400 },
    );
  }

  const messaging = await messagingRuntimeConfigurationCached();
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

  const report = await sendPlanned(messages, {
    adapter,
    optedOut,
    allowlist: parseAllowlist(process.env.BENMP_SEND_ALLOWLIST),
  });
  // Audit trail: every attempt (sent, skipped, failed) lands in sent_messages.
  const audited = await recordSentMessages(
    toSentMessageRows(messages, report.outcomes),
  );
  return NextResponse.json({
    ok: true,
    data: { mode: "sent", report, audited },
  });
}
