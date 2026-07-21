import type {
  MessageSendResult,
  MessagingAdapter,
  OutboundMessage,
} from "./types";

type VonageResponse = {
  message_uuid?: string;
  messageUuid?: string;
  title?: string;
  detail?: string;
};

type VonageMessageType = "text" | "image" | "video" | "audio" | "file";

type VonageRequest = {
  messageType: VonageMessageType;
  content: string | { url: string; caption?: string };
};

export type VonageConfig = {
  apiKey?: string;
  apiSecret?: string;
  whatsappSender?: string;
  messagesApiUrl?: string;
  fetcher?: typeof fetch;
};

const SANDBOX_MESSAGES_URL = "https://messages-sandbox.nexmo.com/v1/messages";

function failed(
  errorMessage: string,
  providerMessageId = "",
): MessageSendResult {
  return {
    provider: "vonage",
    providerMessageId,
    status: "failed",
    errorMessage,
  };
}

function normalizePhone(value: string): string {
  return value.replace(/^whatsapp:/, "").replace(/\D/g, "");
}

function mediaType(
  message: OutboundMessage,
): Exclude<VonageMessageType, "text"> | null {
  const mime = message.mediaType?.toLowerCase().trim();
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "file";

  const pathname = (() => {
    try {
      return new URL(message.mediaUrl ?? "").pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (/\.(jpe?g|png)$/.test(pathname)) return "image";
  if (/\.(mp4|3gp)$/.test(pathname)) return "video";
  if (/\.(aac|m4a|amr|mp3|ogg)$/.test(pathname)) return "audio";
  if (/\.pdf$/.test(pathname)) return "file";
  return null;
}

function requestsFor(message: OutboundMessage): VonageRequest[] | null {
  if (!message.mediaUrl) {
    return [{ messageType: "text", content: message.body }];
  }

  const type = mediaType(message);
  if (!type) return null;

  if (type === "image" || type === "video") {
    return [
      {
        messageType: type,
        content: { url: message.mediaUrl, caption: message.body },
      },
    ];
  }

  return [
    { messageType: "text", content: message.body },
    { messageType: type, content: { url: message.mediaUrl } },
  ];
}

function requestBody(
  request: VonageRequest,
  from: string,
  to: string,
): Record<string, unknown> {
  return {
    from,
    to,
    channel: "whatsapp",
    message_type: request.messageType,
    [request.messageType]: request.content,
  };
}

/** Vonage Messages API adapter, defaulting to its demo-only WhatsApp sandbox. */
export class VonageMessagingAdapter implements MessagingAdapter {
  provider = "vonage" as const;
  private cfg: VonageConfig;

  constructor(cfg: VonageConfig = {}) {
    this.cfg = {
      apiKey: cfg.apiKey ?? process.env.VONAGE_API_KEY,
      apiSecret: cfg.apiSecret ?? process.env.VONAGE_API_SECRET,
      whatsappSender: cfg.whatsappSender ?? process.env.VONAGE_WHATSAPP_SENDER,
      messagesApiUrl:
        cfg.messagesApiUrl ??
        process.env.VONAGE_MESSAGES_API_URL ??
        SANDBOX_MESSAGES_URL,
      fetcher: cfg.fetcher ?? fetch,
    };
  }

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    if (message.channel !== "whatsapp") {
      return failed("Vonage adapter only sends WhatsApp messages");
    }
    if (message.templateId) {
      return failed("Vonage sandbox templates are not configured");
    }

    const { apiKey, apiSecret, whatsappSender, messagesApiUrl, fetcher } =
      this.cfg;
    if (!apiKey || !apiSecret || !whatsappSender || !messagesApiUrl) {
      return failed(
        "VONAGE_API_KEY / VONAGE_API_SECRET / VONAGE_WHATSAPP_SENDER not set",
      );
    }

    const to = normalizePhone(message.to);
    const from = normalizePhone(whatsappSender);
    if (!to) return failed("WhatsApp recipient is invalid");
    if (!from) return failed("Vonage WhatsApp sender is invalid");

    const requests = requestsFor(message);
    if (!requests) {
      return failed("Vonage does not support this attachment type");
    }

    const authorization = Buffer.from(`${apiKey}:${apiSecret}`).toString(
      "base64",
    );
    const providerMessageIds: string[] = [];

    try {
      for (const request of requests) {
        const response = await fetcher!(messagesApiUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Basic ${authorization}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody(request, from, to)),
        });
        const responseText = await response.text();
        let data: VonageResponse = {};
        if (responseText) {
          try {
            data = JSON.parse(responseText) as VonageResponse;
          } catch {
            data = {};
          }
        }

        if (!response.ok) {
          const detail = data.detail ?? data.title ?? `HTTP ${response.status}`;
          return failed(`Vonage: ${detail}`, providerMessageIds.join(","));
        }

        const messageId = data.message_uuid ?? data.messageUuid;
        if (!messageId) {
          return failed(
            "Vonage accepted the request without a message id",
            providerMessageIds.join(","),
          );
        }
        providerMessageIds.push(messageId);
      }

      return {
        provider: this.provider,
        providerMessageId: providerMessageIds.join(","),
        status: "queued",
      };
    } catch (error) {
      return failed(
        error instanceof Error ? error.message : String(error),
        providerMessageIds.join(","),
      );
    }
  }
}
