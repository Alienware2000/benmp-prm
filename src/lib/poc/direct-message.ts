/**
 * Staff-composed messages to specific partners picked in the directory.
 *
 * The reconciliation queues (thank-you / reminder) are generated from what happened in
 * the period. This is the other direction: a staff member searches for a person, writes
 * a message, previews exactly what will be delivered, and confirms. Pure — the route
 * does the I/O.
 *
 * The template supports one placeholder, {name}, resolved per recipient. Partners whose
 * name is missing or the import's "No Name" placeholder get a neutral greeting instead of
 * being addressed as "No".
 */

import type { PlannedMessage } from "../messages";
import { firstName } from "../messages";
import { hasRealName, type DirectoryPartner } from "./directory";

/** Greeting used when we have no usable name for the partner. */
export const NAME_FALLBACK = "Friend";

export const MAX_BODY_LENGTH = 1000;

/** What {name} resolves to for this partner. */
export function greetingFor(partner: Pick<DirectoryPartner, "name">): string {
  return hasRealName(partner.name) ? firstName(partner.name) : NAME_FALLBACK;
}

/** Substitute {name} (all occurrences, case-insensitive on the token). */
export function renderTemplate(template: string, name: string): string {
  return template.replace(/\{name\}/gi, name);
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
  mediaUrl?: string,
): PlannedMessage[] {
  return partners.map((p) => {
    const name = greetingFor(p);
    return {
      kind: "direct" as const,
      to: p.phone,
      name,
      body: renderTemplate(template, name),
      partnerRef: p.id,
      channel: "whatsapp" as const,
      category: "utility" as const,
      sendable: p.phone !== null,
      ...(mediaUrl ? { mediaUrl } : {}),
    };
  });
}
