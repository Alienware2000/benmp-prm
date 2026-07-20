import type {
  MessageSendResult,
  MessagingAdapter,
  OutboundMessage,
} from "./types";

type MetaSuccess = { messages?: Array<{ id?: string }> };
type MetaError = {
  error?: { message?: string; code?: number; error_subcode?: number };
};

export type MetaCloudConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion?: string;
  fetcher?: typeof fetch;
};

function failed(errorMessage: string): MessageSendResult {
  return {
    provider: "meta-cloud-api",
    providerMessageId: "",
    status: "failed",
    errorMessage,
  };
}

/** Direct Meta WhatsApp Cloud API adapter for automated server-side delivery. */
export class MetaCloudMessagingAdapter implements MessagingAdapter {
  provider = "meta-cloud-api" as const;
  private cfg: MetaCloudConfig;

  constructor(cfg: MetaCloudConfig = {}) {
    this.cfg = {
      accessToken:
        cfg.accessToken ??
        process.env.META_WHATSAPP_TOKEN ??
        process.env.META_WHATSAPP_ACCESS_TOKEN,
      phoneNumberId:
        cfg.phoneNumberId ?? process.env.META_WHATSAPP_PHONE_NUMBER_ID,
      apiVersion:
        cfg.apiVersion ?? process.env.META_GRAPH_API_VERSION ?? "v23.0",
      fetcher: cfg.fetcher ?? fetch,
    };
  }

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    if (message.channel !== "whatsapp") {
      return failed("Meta Cloud API adapter only sends WhatsApp messages");
    }

    const { accessToken, phoneNumberId, apiVersion, fetcher } = this.cfg;
    if (!accessToken || !phoneNumberId) {
      return failed(
        "META_WHATSAPP_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID not set",
      );
    }

    const to = message.to.replace(/^whatsapp:/, "").replace(/\D/g, "");
    if (!to) return failed("WhatsApp recipient is invalid");

    const content = message.templateId
      ? {
          type: "template",
          template: {
            name: message.templateId,
            language: { code: message.metadata?.languageCode ?? "en_US" },
          },
        }
      : {
          type: "text",
          text: { preview_url: false, body: message.body },
        };

    try {
      const response = await fetcher!(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            ...content,
          }),
        },
      );
      const data = (await response.json()) as MetaSuccess & MetaError;

      if (!response.ok) {
        const detail = data.error?.message ?? `HTTP ${response.status}`;
        const code = data.error?.code ? ` (${data.error.code})` : "";
        return failed(`Meta Cloud API${code}: ${detail}`);
      }

      const id = data.messages?.[0]?.id;
      return id
        ? {
            provider: this.provider,
            providerMessageId: id,
            status: "queued",
          }
        : failed("Meta Cloud API accepted the request without a message id");
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error));
    }
  }
}
