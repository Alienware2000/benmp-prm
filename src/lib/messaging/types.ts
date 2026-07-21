export type MessagingProvider =
  "mock" | "twilio" | "meta-cloud-api" | "infobip" | "vonage";

export type MessagingChannel = "whatsapp" | "sms" | "email";

export type MessageCategory =
  "marketing" | "utility" | "authentication" | "service" | "internal";

export interface OutboundMessage {
  channel: MessagingChannel;
  to: string;
  body: string;
  /**
   * Publicly reachable URL of one attachment (image, video, audio or PDF).
   *
   * The provider FETCHES this URL — media is never uploaded through the API — so it must
   * be reachable from the public internet and serve a matching Content-Type. WhatsApp
   * allows one attachment per message.
   */
  mediaUrl?: string;
  /** MIME type and original filename let each provider choose its media endpoint safely. */
  mediaType?: string;
  mediaFilename?: string;
  category: MessageCategory;
  subject?: string;
  partnerId?: string;
  templateId?: string;
  metadata?: Record<string, string>;
}

export interface MessageSendResult {
  provider: MessagingProvider;
  providerMessageId: string;
  status: "queued" | "sent" | "failed";
  errorMessage?: string;
}

export interface MessagingAdapter {
  provider: MessagingProvider;
  send(message: OutboundMessage): Promise<MessageSendResult>;
}
