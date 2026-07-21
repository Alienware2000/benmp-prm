import type {
  MessageSendResult,
  MessagingAdapter,
  OutboundMessage,
} from "./types";

type InfobipResponse = {
  messageId?: string;
  status?: {
    groupName?: string;
    name?: string;
    description?: string;
  };
  requestError?: {
    serviceException?: {
      messageId?: string;
      text?: string;
    };
  };
};

export type InfobipConfig = {
  apiKey?: string;
  baseUrl?: string;
  whatsappSender?: string;
  fetcher?: typeof fetch;
};

function failed(errorMessage: string): MessageSendResult {
  return {
    provider: "infobip",
    providerMessageId: "",
    status: "failed",
    errorMessage,
  };
}

function endpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${normalized}/whatsapp/1/message/text`;
}

function acceptedStatus(
  groupName?: string,
): MessageSendResult["status"] | undefined {
  const normalized = groupName?.toUpperCase();
  if (normalized === "DELIVERED") return "sent";
  if (normalized === "PENDING") return "queued";
  return undefined;
}

/** Infobip WhatsApp API adapter, including its shared free-trial sender. */
export class InfobipMessagingAdapter implements MessagingAdapter {
  provider = "infobip" as const;
  private cfg: InfobipConfig;

  constructor(cfg: InfobipConfig = {}) {
    this.cfg = {
      apiKey: cfg.apiKey ?? process.env.INFOBIP_API_KEY,
      baseUrl: cfg.baseUrl ?? process.env.INFOBIP_BASE_URL,
      whatsappSender: cfg.whatsappSender ?? process.env.INFOBIP_WHATSAPP_SENDER,
      fetcher: cfg.fetcher ?? fetch,
    };
  }

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    if (message.channel !== "whatsapp") {
      return failed("Infobip adapter only sends WhatsApp messages");
    }
    if (message.templateId) {
      return failed("Infobip template messages are not configured yet");
    }

    const { apiKey, baseUrl, whatsappSender, fetcher } = this.cfg;
    if (!apiKey || !baseUrl || !whatsappSender) {
      return failed(
        "INFOBIP_API_KEY / INFOBIP_BASE_URL / INFOBIP_WHATSAPP_SENDER not set",
      );
    }

    const to = message.to.replace(/^whatsapp:/, "").replace(/\D/g, "");
    const from = whatsappSender.replace(/^whatsapp:/, "").replace(/\D/g, "");
    if (!to) return failed("WhatsApp recipient is invalid");
    if (!from) return failed("Infobip WhatsApp sender is invalid");

    try {
      const response = await fetcher!(endpoint(baseUrl), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `App ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          content: { text: message.body },
        }),
      });
      const data = (await response.json()) as InfobipResponse;

      if (!response.ok) {
        const detail =
          data.requestError?.serviceException?.text ??
          data.status?.description ??
          `HTTP ${response.status}`;
        return failed(`Infobip: ${detail}`);
      }

      if (!data.messageId) {
        return failed("Infobip accepted the request without a message id");
      }

      const status = acceptedStatus(data.status?.groupName);
      if (!status) {
        const detail =
          data.status?.description ??
          data.status?.name ??
          "Infobip rejected the message";
        return failed(detail);
      }

      return {
        provider: this.provider,
        providerMessageId: data.messageId,
        status,
      };
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error));
    }
  }
}
