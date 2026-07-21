/**
 * Message send loop for the POC (POC-3).
 *
 * Takes the PlannedMessage[] from POC-2 and dispatches the sendable ones through the
 * existing MessagingAdapter (mock by default, via BENMP_MESSAGING_PROVIDER). Un-sendable
 * (no phone) and opted-out recipients are skipped, not sent; a provider error is recorded,
 * never thrown. Every attempt emits a structured, greppable log line.
 */

import { getMessagingAdapter } from "./messaging";
import type { MessagingAdapter } from "./messaging/types";
import type { PlannedMessage } from "./messages";
import { normalizePhone } from "./phone";

export type SendStatus = "queued" | "sent" | "skipped" | "failed";

export type SendOutcome = {
  partnerRef: string;
  to: string | null;
  kind: PlannedMessage["kind"];
  status: SendStatus;
  providerMessageId?: string;
  reason?: string;
};

export type SendReport = {
  total: number;
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Skip counts by reason ("no phone" | "opted out" | "not in allowlist") — lets the UI explain a skip as the safety feature it is. */
  skippedByReason: Record<string, number>;
  outcomes: SendOutcome[];
};

export type SendOptions = {
  adapter?: MessagingAdapter;
  /** E.164 phones that have opted out — skipped before dispatch. */
  optedOut?: Set<string>;
  /**
   * Training wheels (BENMP_SEND_ALLOWLIST): when non-null, only these E.164 phones are
   * dispatched — everything else is skipped. null/undefined = no restriction.
   */
  allowlist?: Set<string> | null;
  /** Structured sink for send events; defaults to console.info. */
  log?: (event: Record<string, unknown>) => void;
};

/**
 * Parse the BENMP_SEND_ALLOWLIST env value (comma/space-separated phone numbers) into a
 * set of E.164 phones. Returns null when the variable is unset, empty, or contains no
 * usable number — meaning "no restriction". Unparseable entries are dropped.
 */
export function parseAllowlist(
  raw: string | undefined | null,
): Set<string> | null {
  if (!raw || !raw.trim()) return null;
  const phones = raw
    .split(/[,\s]+/)
    .map((p) => normalizePhone(p))
    .filter((p): p is string => p !== null);
  return phones.length > 0 ? new Set(phones) : null;
}

export async function sendPlanned(
  messages: PlannedMessage[],
  opts: SendOptions = {},
): Promise<SendReport> {
  const adapter = opts.adapter ?? getMessagingAdapter();
  const optedOut = opts.optedOut ?? new Set<string>();
  const allowlist = opts.allowlist ?? null;
  const log = opts.log ?? ((e) => console.info(JSON.stringify(e)));

  const outcomes: SendOutcome[] = [];

  for (const m of messages) {
    const base = { partnerRef: m.partnerRef, to: m.to, kind: m.kind };

    if (!m.sendable || m.to === null) {
      const outcome: SendOutcome = {
        ...base,
        status: "skipped",
        reason: "no phone",
      };
      outcomes.push(outcome);
      log({ evt: "poc_send", ...outcome });
      continue;
    }
    if (optedOut.has(m.to)) {
      const outcome: SendOutcome = {
        ...base,
        status: "skipped",
        reason: "opted out",
      };
      outcomes.push(outcome);
      log({ evt: "poc_send", ...outcome });
      continue;
    }
    if (allowlist && !allowlist.has(m.to)) {
      const outcome: SendOutcome = {
        ...base,
        status: "skipped",
        reason: "not in allowlist",
      };
      outcomes.push(outcome);
      log({ evt: "poc_send", ...outcome });
      continue;
    }

    try {
      const res = await adapter.send({
        channel: m.channel,
        to: m.to,
        body: m.body,
        category: m.category,
        partnerId: m.partnerRef,
        ...(m.mediaUrl ? { mediaUrl: m.mediaUrl } : {}),
        ...(m.mediaType ? { mediaType: m.mediaType } : {}),
        ...(m.mediaFilename ? { mediaFilename: m.mediaFilename } : {}),
      });
      const outcome: SendOutcome =
        res.status === "failed"
          ? {
              ...base,
              status: "failed",
              providerMessageId: res.providerMessageId,
              reason: res.errorMessage,
            }
          : {
              ...base,
              status: res.status,
              providerMessageId: res.providerMessageId,
            };
      outcomes.push(outcome);
      log({ evt: "poc_send", provider: adapter.provider, ...outcome });
    } catch (err) {
      const outcome: SendOutcome = {
        ...base,
        status: "failed",
        reason: err instanceof Error ? err.message : String(err),
      };
      outcomes.push(outcome);
      log({ evt: "poc_send", provider: adapter.provider, ...outcome });
    }
  }

  const skippedByReason: Record<string, number> = {};
  for (const o of outcomes) {
    if (o.status === "skipped" && o.reason) {
      skippedByReason[o.reason] = (skippedByReason[o.reason] ?? 0) + 1;
    }
  }

  return {
    total: outcomes.length,
    queued: outcomes.filter((o) => o.status === "queued").length,
    sent: outcomes.filter((o) => o.status === "sent").length,
    skipped: outcomes.filter((o) => o.status === "skipped").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    skippedByReason,
    outcomes,
  };
}
