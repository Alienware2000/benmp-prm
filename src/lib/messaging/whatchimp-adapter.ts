import type {
  MessageSendResult,
  MessagingAdapter,
  OutboundMessage,
} from "./types";

type WhatChimpResponse = {
  status?: string | number;
  wa_message_id?: string;
  message?: string;
};

export type WhatChimpConfig = {
  apiToken?: string;
  phoneNumberId?: string;
  apiUrl?: string;
  fetcher?: typeof fetch;
};

const DEFAULT_API_URL = "https://app.whatchimp.com/api/v1/whatsapp/send";

function failed(errorMessage: string): MessageSendResult {
  return {
    provider: "whatchimp",
    providerMessageId: "",
    status: "failed",
    errorMessage,
  };
}

function normalizePhone(value: string): string {
  return value.replace(/^whatsapp:/, "").replace(/\D/g, "");
}

function requestBody(
  message: OutboundMessage,
  apiToken: string,
  phoneNumberId: string,
): URLSearchParams {
  const body = new URLSearchParams({
    apiToken,
    phone_number_id: phoneNumberId,
    phone_number: normalizePhone(message.to),
  });

  if (!message.templateId) {
    body.set("message", message.body);
    return body;
  }

  body.set("template_name", message.templateId);
  body.set("language_code", message.metadata?.templateLanguage ?? "en_US");

  for (const [key, value] of Object.entries(message.metadata ?? {})) {
    if (/^variable\d+$/.test(key)) body.set(key, value);
  }

  return body;
}

/** WhatChimp's server-side API for Meta-hosted WhatsApp text and template sends. */
export class WhatChimpMessagingAdapter implements MessagingAdapter {
  provider = "whatchimp" as const;
  private cfg: WhatChimpConfig;

  constructor(cfg: WhatChimpConfig = {}) {
    this.cfg = {
      apiToken: cfg.apiToken ?? process.env.WHATCHIMP_API_TOKEN,
      phoneNumberId: cfg.phoneNumberId ?? process.env.WHATCHIMP_PHONE_NUMBER_ID,
      apiUrl: cfg.apiUrl ?? process.env.WHATCHIMP_API_URL ?? DEFAULT_API_URL,
      fetcher: cfg.fetcher ?? fetch,
    };
  }

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    if (message.channel !== "whatsapp") {
      return failed("WhatChimp adapter only sends WhatsApp messages");
    }
    if (message.mediaUrl) {
      return failed("WhatChimp media messages are not configured yet");
    }

    const { apiToken, phoneNumberId, apiUrl, fetcher } = this.cfg;
    if (!apiToken || !phoneNumberId || !apiUrl) {
      return failed("WHATCHIMP_API_TOKEN / WHATCHIMP_PHONE_NUMBER_ID not set");
    }
    if (!normalizePhone(message.to)) {
      return failed("WhatsApp recipient is invalid");
    }
    if (!message.templateId && !message.body.trim()) {
      return failed("WhatsApp message is empty");
    }

    try {
      const response = await fetcher!(apiUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody(message, apiToken, phoneNumberId),
      });
      const responseText = await response.text();
      let data: WhatChimpResponse = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as WhatChimpResponse;
        } catch {
          data = {};
        }
      }

      if (!response.ok || String(data.status) !== "1") {
        return failed(
          `WhatChimp: ${data.message ?? `HTTP ${response.status}`}`,
        );
      }
      if (!data.wa_message_id) {
        return failed("WhatChimp accepted the request without a message id");
      }

      return {
        provider: this.provider,
        providerMessageId: data.wa_message_id,
        status: "queued",
      };
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error));
    }
  }
}
