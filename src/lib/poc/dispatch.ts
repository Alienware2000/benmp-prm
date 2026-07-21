/**
 * POC send orchestration — the connective tissue between reconciliation and the send loop.
 *
 * The /poc console previews the planned messages first (summarizePlan) and only dispatches
 * on an explicit confirm, so a click can never accidentally blast real partners. Actual
 * sending goes through the existing send loop (sendPlanned) and whatever messaging adapter
 * is configured (mock until BENMP_MESSAGING_PROVIDER=twilio).
 */

import type { PlannedMessage } from "../messages";

export type PlanSummary = {
  total: number;
  sendable: number;
  skippedNoPhone: number;
  /** Planned recipients excluded by the opt_outs consent gate. */
  optedOut: number;
  thankYou: number;
  reminder: number;
  /** Staff-composed directory messages — neither of the two planned queues. */
  direct: number;
  /** A few examples for the preview — never the whole list. */
  sample: Array<{ kind: PlannedMessage["kind"]; name: string; to: string | null; body: string }>;
};

export type SummarizeOptions = {
  sampleSize?: number;
  /** E.164 phones that opted out — counted separately and removed from sendable. */
  optedOut?: Set<string>;
};

export function summarizePlan(messages: PlannedMessage[], opts: SummarizeOptions = {}): PlanSummary {
  const sampleSize = opts.sampleSize ?? 5;
  const optedOutSet = opts.optedOut ?? new Set<string>();
  let sendable = 0;
  let skippedNoPhone = 0;
  let optedOut = 0;
  let thankYou = 0;
  let reminder = 0;
  let direct = 0;

  for (const m of messages) {
    if (!m.sendable || m.to === null) skippedNoPhone++;
    else if (optedOutSet.has(m.to)) optedOut++;
    else sendable++;
    // Count each kind explicitly — an "everything else is a reminder" fallback silently
    // mis-labelled directory messages as reminders.
    if (m.kind === "thank_you") thankYou++;
    else if (m.kind === "reminder") reminder++;
    else direct++;
  }

  return {
    total: messages.length,
    sendable,
    skippedNoPhone,
    optedOut,
    thankYou,
    reminder,
    direct,
    sample: messages.slice(0, sampleSize).map((m) => ({
      kind: m.kind,
      name: m.name,
      to: m.to,
      body: m.body,
    })),
  };
}

export type PlanKind = "thank_you" | "reminder" | "all";

/** Restrict a plan to one queue (Message Center operates thank-yous and reminders independently). */
export function filterByKind(messages: PlannedMessage[], kind: PlanKind): PlannedMessage[] {
  if (kind === "all") return messages;
  return messages.filter((m) => m.kind === kind);
}
