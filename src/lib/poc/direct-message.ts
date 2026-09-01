/**
 * Staff-composed messages to specific partners picked in the directory.
 *
 * The reconciliation queues (thank-you / reminder) are generated from what happened in
 * the period. This is the other direction: a staff member searches for a person, writes
 * a message, previews exactly what will be delivered, and confirms. Pure — the route
 * does the I/O.
 *
 * Templates support {name} and {amount}, resolved per recipient. Partners whose name is
 * missing get a neutral greeting. Partners without recorded giving get the phrase
 * "your support", so a giving template remains grammatical instead of inventing money.
 */

import type { PlannedMessage } from "../messages";
import { firstName } from "../messages";
import { hasRealName, type DirectoryPartner } from "./directory";
import type { MessagingChannel } from "../messaging/types";
import type { MediaAsset } from "./media";

/** Greeting used when we have no usable name for the partner. */
export const NAME_FALLBACK = "Friend";
export const AMOUNT_FALLBACK = "your support";

export const MAX_BODY_LENGTH = 1000;

/** What {name} resolves to for this partner. */
export function greetingFor(partner: Pick<DirectoryPartner, "name">): string {
  return hasRealName(partner.name) ? firstName(partner.name) : NAME_FALLBACK;
}

/** What {amount} resolves to for this partner. */
export function amountFor(
  partner: Pick<DirectoryPartner, "givenMinor">,
): string {
  if (partner.givenMinor <= 0) return AMOUNT_FALLBACK;
  return `GHS ${(partner.givenMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Substitute supported tokens (all occurrences, case-insensitive). */
export function renderTemplate(
  template: string,
  name: string,
  amount = AMOUNT_FALLBACK,
): string {
  return template.replace(/\{name\}/gi, name).replace(/\{amount\}/gi, amount);
}

export type TemplateProblem = "empty" | "too_long";

export function validateTemplate(template: string): TemplateProblem | null {
  const trimmed = template.trim();
  if (!trimmed) return "empty";
  if (trimmed.length > MAX_BODY_LENGTH) return "too_long";
  return null;
}

/**
 * Turn selected partners + a template into planned messages.
 *
 * Partners with no phone are still returned, with `sendable: false`, so the preview can
 * show them as "will not be sent" rather than silently shrinking the recipient list.
 */
export function buildDirectMessages(
  partners: DirectoryPartner[],
  template: string,
  media?: Pick<MediaAsset, "url" | "mimeType" | "filename">,
  channel: MessagingChannel = "whatsapp",
): PlannedMessage[] {
  return partners.map((p) => {
    const name = greetingFor(p);
    const amount = amountFor(p);
    return {
      kind: "direct" as const,
      to: p.phone,
      name,
      body: renderTemplate(template, name, amount),
      partnerRef: p.id,
      channel,
      category: "utility" as const,
      sendable: p.phone !== null,
      ...(media
        ? {
            mediaUrl: media.url,
            mediaType: media.mimeType,
            mediaFilename: media.filename,
          }
        : {}),
    };
  });
}
