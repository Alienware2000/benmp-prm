/**
 * SMS cost rules — the guard that stops a long message becoming a five-figure bill.
 *
 * WhatsApp is priced per conversation, so message length barely matters. SMS is priced
 * per 160-character *part*, and one character over a boundary doubles the cost of the
 * entire campaign. The real numbers from the legacy Ghana list: the original
 * 881-character notice costs 6 credits per recipient (65,058 for 10,843 people), the
 * reframed 274-character version costs 2 (21,686). Same audience, same day, 43,000
 * credits apart.
 *
 * So the composer must show the cost before the confirm button, not after the send.
 *
 * Boundaries verified against FlashSMS `/sms/estimate` on 2026-09-01:
 *   160 chars -> 1 part | 161 -> 2 | 306 -> 2 | 307 -> 3 | 459 -> 3
 * i.e. a single part holds 160, and concatenated parts hold 153 each (the remaining
 * 7 bytes carry the segmentation header).
 *
 * This is the local estimate, used for live feedback while staff type. The provider's
 * own /sms/estimate stays the authority and is what the send route checks against the
 * account balance — this must never be the only thing between staff and a charge.
 */

export const SMS_SINGLE_LIMIT = 160;
export const SMS_CONCAT_PART = 153;
export const SMS_UNICODE_SINGLE = 70;
export const SMS_UNICODE_CONCAT = 67;

/**
 * GSM-7 vs Unicode: one emoji or curly quote drops the limit from 160 to 70, so a
 * message that looked like one part becomes three. Detected as "anything outside the
 * Latin-1 range an office keyboard reasonably produces".
 */
export function isUnicodeSms(body: string): boolean {
  return [...body].some((ch) => ch.codePointAt(0)! > 0xff);
}

/** How many parts a message will be split into. */
export function smsParts(body: string): number {
  const length = [...body].length;
  if (length === 0) return 0;
  const unicode = isUnicodeSms(body);
  const single = unicode ? SMS_UNICODE_SINGLE : SMS_SINGLE_LIMIT;
  const concat = unicode ? SMS_UNICODE_CONCAT : SMS_CONCAT_PART;
  return length <= single ? 1 : Math.ceil(length / concat);
}

export type SmsCost = {
  characters: number;
  parts: number;
  /** One credit per part, per recipient. */
  creditsPerRecipient: number;
  creditsTotal: number;
  unicode: boolean;
  /** Characters that can still be added before the next part begins. */
  charactersUntilNextPart: number;
};

export function smsCost(body: string, recipients: number): SmsCost {
  const characters = [...body].length;
  const parts = smsParts(body);
  const unicode = isUnicodeSms(body);
  const single = unicode ? SMS_UNICODE_SINGLE : SMS_SINGLE_LIMIT;
  const concat = unicode ? SMS_UNICODE_CONCAT : SMS_CONCAT_PART;
  const capacity = parts <= 1 ? single : parts * concat;
  return {
    characters,
    parts,
    creditsPerRecipient: parts,
    creditsTotal: parts * recipients,
    unicode,
    charactersUntilNextPart: Math.max(0, capacity - characters),
  };
}
