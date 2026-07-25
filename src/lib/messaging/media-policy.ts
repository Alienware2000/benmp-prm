import type { MessagingProvider } from "./types";

/** Wali's current WhatsApp connector rejects attachments larger than 3 MB. */
export const WALI_MAX_ATTACHMENT_BYTES = 3_000_000;

export function attachmentLimitBytes(
  provider: MessagingProvider,
): number | null {
  return provider === "wali" ? WALI_MAX_ATTACHMENT_BYTES : null;
}

export function attachmentExceedsProviderLimit(
  provider: MessagingProvider,
  sizeBytes: number,
): boolean {
  const limit = attachmentLimitBytes(provider);
  return limit !== null && sizeBytes > limit;
}
