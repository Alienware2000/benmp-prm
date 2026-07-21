/**
 * Message planning for the Ghana/MoMo POC (POC-2).
 *
 * Turns a ReconciliationResult into the messages to send:
 *   - thank_you  -> everyone who paid: registeredPaid AND paidUnregistered
 *                   (Bishop Ebo's rule — a payer is never dropped for being unregistered).
 *   - reminder   -> registeredUnpaid, but only once the due date has passed
 *                   (event-driven; there is no pledge amount to quote — Decision 0008).
 *
 * Pure, no I/O. Each PlannedMessage maps onto the existing OutboundMessage
 * (src/lib/messaging/types.ts) at send time (POC-3); `to` is null when the phone
 * can't be normalized, so the message is planned + visible but not sendable.
 */

import { normalizePhone } from "./phone";
import type { ReconciliationResult } from "./reconcile";
import type { MessageCategory, MessagingChannel } from "./messaging/types";

/** Gifts at or above this (GHS) get the warmer "VIP" thank-you (matches the high-touch tier). */
export const VIP_THRESHOLD_MINOR = 100_00;

/**
 * "direct" is a staff-composed message to specific partners chosen in the directory,
 * as opposed to the two planned queues that fall out of reconciliation. It never
 * originates from planMessages() — only from the directory send path.
 */
export type MessageKind = "thank_you" | "reminder" | "direct";

export type PlannedMessage = {
  kind: MessageKind;
  /** E.164 phone, or null when it can't be normalized (then sendable=false). */
  to: string | null;
  name: string;
  body: string;
  /** Registration id for registered partners, or the payment reference for unregistered payers. */
  partnerRef: string;
  channel: MessagingChannel;
  category: MessageCategory;
  sendable: boolean;
};

export type Templates = {
  thankYou: (name: string, amountGhs: string) => string;
  vip: (name: string, amountGhs: string) => string;
  reminder: (name: string) => string;
};

const TITLE_RE = /\b(Rev\.?|LP\.?|Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Pastor|Ps\.?|Ps)\b/gi;

/** First name for a greeting, with common titles stripped ("Rev. Kofi Boateng" -> "Kofi"). */
export function firstName(fullName: string): string {
  const cleaned = fullName.replace(TITLE_RE, "");
  // A stripped title can leave a stray "." (e.g. "Rev. Kofi" -> ". Kofi"); keep only
  // tokens that actually contain a letter.
  const parts = cleaned.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  return parts[0] || fullName.trim() || "Friend";
}

/** Display GHS from integer minor units (display only — never used for a rule decision). */
function formatGhs(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const pesewas = Math.abs(minor % 100);
  return pesewas === 0 ? `${whole}` : `${whole}.${String(pesewas).padStart(2, "0")}`;
}

const DEFAULT_TEMPLATES: Templates = {
  thankYou: (name, amt) =>
    `Hi ${name}, thank you for your GHS ${amt} gift to BENMP. Your partnership means so much. God richly bless you!`,
  vip: (name, amt) =>
    `Dear ${name}, we are deeply grateful for your generous GHS ${amt} gift to BENMP. Thank you for standing with us in such a special way!`,
  reminder: (name) =>
    `Hi ${name}, a gentle reminder to send your BENMP partnership gift by MoMo whenever you're ready. Thank you and God bless!`,
};

function plan(
  kind: MessageKind,
  rawName: string | null,
  rawPhone: string | null,
  partnerRef: string,
  body: string,
): PlannedMessage {
  const to = normalizePhone(rawPhone);
  return {
    kind,
    to,
    name: firstName(rawName ?? ""),
    body,
    partnerRef,
    channel: "whatsapp",
    category: "utility",
    sendable: to !== null,
  };
}

export function planMessages(
  result: ReconciliationResult,
  opts: { asOf: string; dueDate: string; templates?: Templates },
): PlannedMessage[] {
  const t = opts.templates ?? DEFAULT_TEMPLATES;
  const messages: PlannedMessage[] = [];

  // Thank registered payers.
  for (const rp of result.registeredPaid) {
    const name = firstName(rp.registration.fullName);
    const amt = formatGhs(rp.totalMinor);
    const body = rp.totalMinor >= VIP_THRESHOLD_MINOR ? t.vip(name, amt) : t.thankYou(name, amt);
    messages.push(plan("thank_you", rp.registration.fullName, rp.registration.phone, rp.registration.id, body));
  }

  // Thank unregistered payers too (Bishop Ebo's rule) — one message per person,
  // covering their total across payments, same as registered partners.
  for (const pu of result.paidUnregistered) {
    const name = firstName(pu.suggestedName ?? "");
    const amt = formatGhs(pu.totalMinor);
    const body = pu.totalMinor >= VIP_THRESHOLD_MINOR ? t.vip(name, amt) : t.thankYou(name, amt);
    messages.push(plan("thank_you", pu.suggestedName, pu.phone, pu.payments[0].reference, body));
  }

  // Remind registered-but-unpaid — only if the due date has passed (event-driven).
  if (opts.dueDate < opts.asOf) {
    for (const r of result.registeredUnpaid) {
      messages.push(plan("reminder", r.fullName, r.phone, r.id, t.reminder(firstName(r.fullName))));
    }
  }

  return messages;
}
