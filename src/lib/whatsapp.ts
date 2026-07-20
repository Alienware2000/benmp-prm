import { normalizePhone } from "./phone";

/**
 * Build an official WhatsApp click-to-chat URL for an assisted staff send.
 * Returns null when the phone or message is unusable.
 */
export function buildWhatsAppUrl(
  rawPhone: string | null | undefined,
  message: string,
): string | null {
  const phone = normalizePhone(rawPhone);
  const body = message.trim();
  if (!phone || !body) return null;

  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(body)}`;
}
