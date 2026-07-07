export type MessagingProvider = "mock" | "twilio" | "meta-cloud-api";

export type MessagingChannel = "whatsapp" | "sms" | "email";

export type MessageCategory =
  "marketing" | "utility" | "authentication" | "service" | "internal";

export interface OutboundMessage {
  channel: MessagingChannel;
  to: string;
  body: string;
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
