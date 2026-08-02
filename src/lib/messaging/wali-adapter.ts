import { normalizePhone } from "../phone";
import type {
  MessageSendResult,
  MessagingAdapter,
  OutboundMessage,
} from "./types";

type WaliResponse = {
  id?: string;
  _id?: string;
  status?: string;
  message?: string;
  error?: string;
  errors?: Array<{ message?: string; reason?: string }>;
};

export type WaliConfig = {
  apiKey?: string;
  deviceId?: string;
  apiUrl?: string;
  fetcher?: typeof fetch;
};

const DEFAULT_API_URL = "https://api.wali.chat/v1/messages";

function failed(
  errorMessage: string,
  providerMessageId = "",
): MessageSendResult {
  return {
    provider: "wali",
    providerMessageId,
    status: "failed",
    errorMessage,
  };
}

function recipient(value: string): string | null {
  return normalizePhone(value.replace(/^whatsapp:/, ""));
}

function templateBody(
  metadata: Record<string, string> | undefined,
): Array<{ name: string; value: string }> {
  return Object.entries(metadata ?? {})
    .filter(([key]) => /^variable\d+$/.test(key))
    .sort(([a], [b]) => Number(a.slice(8)) - Number(b.slice(8)))
    .map(([key, value]) => ({ name: key.slice(8), value }));
}

function detail(data: WaliResponse, status: number): string {
  return (
    data.message ??
    data.error ??
    data.errors?.[0]?.message ??
    data.errors?.[0]?.reason ??
    `HTTP ${status}`
  );
}

function actionableDetail(message: string): string {
  if (
    /device is invalid|device does not exist|proper target device id|device.+not operative/i.test(
      message,
    )
  ) {
    return "The BENMP WhatsApp sender is disconnected from WaliChat. Reconnect the BENMP number in WaliChat, then refresh the platform and try again.";
  }
  return `Wali: ${message}`;
}

function mapStatus(status: string | undefined): MessageSendResult["status"] {
  if (status === "processed") return "sent";
  if (status === "queued" || status === "processing" || !status) {
    return "queued";
  }
  return "failed";
}

/** WaliChat server-side API adapter for the BENMP WhatsApp Business number. */
export class WaliMessagingAdapter implements MessagingAdapter {
  provider = "wali" as const;
  private cfg: WaliConfig;

  constructor(cfg: WaliConfig = {}) {
    this.cfg = {
      apiKey: cfg.apiKey ?? process.env.WALI_API_KEY,
      deviceId: cfg.deviceId ?? process.env.WALI_DEVICE_ID,
      apiUrl: cfg.apiUrl ?? process.env.WALI_API_URL ?? DEFAULT_API_URL,
      fetcher: cfg.fetcher ?? fetch,
    };
  }

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    if (message.channel !== "whatsapp") {
      return failed("Wali adapter only sends WhatsApp messages");
    }
    if (message.templateId && message.mediaUrl) {
      return failed("Wali template media headers are not configured yet");
    }

    const { apiKey, deviceId, apiUrl, fetcher } = this.cfg;
    if (!apiKey || !deviceId || !apiUrl) {
      return failed("WALI_API_KEY / WALI_DEVICE_ID not set");
    }

    const to = recipient(message.to);
    if (!to) return failed("WhatsApp recipient is invalid");
    if (!message.templateId && !message.mediaUrl && !message.body.trim()) {
      return failed("WhatsApp message is empty");
    }

    const payload: Record<string, unknown> = {
      phone: to,
      device: deviceId,
      enqueue: "always",
    };

    if (message.templateId) {
      payload.template = {
        name: message.templateId,
        language: message.metadata?.templateLanguage ?? "en_US",
        body: templateBody(message.metadata),
      };
    } else if (message.mediaUrl) {
      payload.media = {
        url: message.mediaUrl,
        ...(message.body.trim() ? { message: message.body } : {}),
        ...(message.mediaFilename
          ? { filename: message.mediaFilename.slice(0, 200) }
          : {}),
      };
    } else {
      payload.message = message.body;
    }

    const reference =
      message.metadata?.providerReference ?? message.partnerId?.trim();
    if (reference) payload.reference = reference.slice(0, 150);

    try {
      const response = await fetcher!(apiUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Token: apiKey,
        },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      let data: WaliResponse = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as WaliResponse;
        } catch {
          data = {};
        }
      }

      const providerMessageId = data.id ?? data._id ?? "";
      if (!response.ok) {
        return failed(actionableDetail(detail(data, response.status)));
      }
      if (!providerMessageId) {
        return failed("Wali accepted the request without a message id");
      }

      const status = mapStatus(data.status);
      if (status === "failed") {
        return failed(
          actionableDetail(detail(data, response.status)),
          providerMessageId,
        );
      }

      return {
        provider: this.provider,
        providerMessageId,
        status,
      };
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error));
    }
  }
}
