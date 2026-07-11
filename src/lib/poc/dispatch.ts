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
  thankYou: number;
  reminder: number;
  /** A few examples for the preview — never the whole list. */
  sample: Array<{ kind: PlannedMessage["kind"]; name: string; to: string | null; body: string }>;
};

export function summarizePlan(messages: PlannedMessage[], sampleSize = 5): PlanSummary {
  let sendable = 0;
  let skippedNoPhone = 0;
  let thankYou = 0;
  let reminder = 0;

  for (const m of messages) {
    if (m.sendable && m.to !== null) sendable++;
    else skippedNoPhone++;
    if (m.kind === "thank_you") thankYou++;
    else reminder++;
  }

  return {
    total: messages.length,
    sendable,
    skippedNoPhone,
    thankYou,
    reminder,
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
