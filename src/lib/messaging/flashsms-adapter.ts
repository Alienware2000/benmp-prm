import type {
  MessageSendResult,
  MessagingAdapter,
  OutboundMessage,
} from "./types";

/**
 * FlashSMS Africa REST API v2 — the SMS path.
 *
 * Chosen for the legacy Ghana broadcast because SMS has no 24-hour session window and
 * no Meta template approval: WhatsApp rejected that campaign outright since none of the
 * 11k archived contacts had messaged us recently.
 *
 * Two shapes of the same endpoint:
 *  - `send()` satisfies MessagingAdapter (one recipient), so it drops into the existing
 *    send loop unchanged.
 *  - `sendBulk()` posts many phones in ONE request. v2 answers 202 and queues the
 *    campaign rather than blocking, which is how 11k recipients go out without the
 *    per-recipient loop that made WhatsApp slow and fragile.
 *
 * Docs: https://app.flashsms.africa/docs
 */

export type FlashSmsConfig = {
  apiKey?: string;
  apiUrl?: string;
  senderId?: string;
  fetcher?: typeof fetch;
  /** Injectable so tests get deterministic idempotency keys. */
  idempotencyKey?: () => string;
};

const DEFAULT_API_URL = "https://app.flashsms.africa/api/v2";

type FlashSmsEnvelope = {
  data?: {
    id?: string;
    status?: string;
    recipientCount?: number;
    invalidRecipients?: string[];
    creditsUsed?: number;
    remainingCredits?: number;
  };
  error?: { code?: string; message?: string; details?: unknown };
  meta?: { requestId?: string };
};

export type FlashSmsBulkResult = {
  ok: boolean;
  campaignId: string;
  recipientCount: number;
  invalidRecipients: string[];
  creditsUsed: number;
  remainingCredits: number;
  errorCode?: string;
  errorMessage?: string;
};

export type FlashSmsEstimate = {
  partsPerMessage: number;
  recipientCount: number;
  creditsNeeded: number;
  currentBalance: number;
  canAfford: boolean;
};

function failed(errorMessage: string): MessageSendResult {
  return {
    provider: "flashsms",
    providerMessageId: "",
    status: "failed",
    errorMessage,
  };
}

/**
 * FlashSMS wants Ghana numbers as `0XXXXXXXXX` or `233XXXXXXXXX` — a leading "+" is not
 * in their accepted forms, and our contacts are all stored E.164. Strip it and keep the
 * digits; anything else is left to the API to reject rather than silently reshaped.
 */
export function toFlashSmsPhone(value: string): string {
  return value.replace(/^whatsapp:/, "").replace(/\D/g, "");
}

/** Human-readable line for a typed FlashSMS error, kept greppable in logs. */
function describeError(env: FlashSmsEnvelope, status: number): string {
  const code = env.error?.code ?? `HTTP_${status}`;
  const message = env.error?.message ?? "unknown error";
  return `FlashSMS ${code}: ${message}`;
}

export class FlashSmsMessagingAdapter implements MessagingAdapter {
  provider = "flashsms" as const;
  private cfg: Required<Pick<FlashSmsConfig, "apiUrl">> & FlashSmsConfig;

  constructor(cfg: FlashSmsConfig = {}) {
    this.cfg = {
      apiKey: cfg.apiKey ?? process.env.FLASHSMS_API_KEY,
      apiUrl: cfg.apiUrl ?? process.env.FLASHSMS_API_URL ?? DEFAULT_API_URL,
      senderId: cfg.senderId ?? process.env.FLASHSMS_SENDER_ID,
      fetcher: cfg.fetcher ?? fetch,
      idempotencyKey: cfg.idempotencyKey ?? (() => crypto.randomUUID()),
    };
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    idempotent: boolean,
  ): Promise<{ env: FlashSmsEnvelope; status: number }> {
    const fetcher = this.cfg.fetcher ?? fetch;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.apiKey}`,
      "Content-Type": "application/json",
    };
    // v2 requires a fresh UUID per logical send; replays inside 24h return the original
    // response, which is what makes a retry after a network error safe.
    if (idempotent) headers["Idempotency-Key"] = this.cfg.idempotencyKey!();

    const res = await fetcher(`${this.cfg.apiUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const env = (await res.json().catch(() => ({}))) as FlashSmsEnvelope;
    return { env, status: res.status };
  }

  /** One recipient, for the shared send loop. */
  async send(message: OutboundMessage): Promise<MessageSendResult> {
    if (message.channel !== "sms") {
      return failed("FlashSMS adapter only sends SMS messages");
    }
    if (message.mediaUrl) {
      return failed("FlashSMS does not support media attachments");
    }
    if (!this.cfg.apiKey) {
      return failed("FLASHSMS_API_KEY is not set");
    }

    try {
      const { env, status } = await this.post(
        "/sms/send",
        {
          message: message.body,
          phones: [toFlashSmsPhone(message.to)],
          ...(this.cfg.senderId ? { senderId: this.cfg.senderId } : {}),
        },
        true,
      );
      if (env.error || status >= 400) {
        return failed(describeError(env, status));
      }
      // v2 answers 202 with status PENDING — accepted and queued, not yet delivered.
      return {
        provider: "flashsms",
        providerMessageId: env.data?.id ?? "",
        status: "queued",
      };
    } catch (err) {
      return failed(
        `FlashSMS request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Many recipients in one request. Returns the campaign id — delivery per recipient is
   * then tracked through /sms/status/{id}, not through this call.
   */
  async sendBulk(
    phones: string[],
    body: string,
    opts: { scheduledAt?: string } = {},
  ): Promise<FlashSmsBulkResult> {
    const empty = {
      campaignId: "",
      recipientCount: 0,
      invalidRecipients: [],
      creditsUsed: 0,
      remainingCredits: 0,
    };
    if (!this.cfg.apiKey) {
      return {
        ...empty,
        ok: false,
        errorMessage: "FLASHSMS_API_KEY is not set",
      };
    }
    if (phones.length === 0) {
      return { ...empty, ok: false, errorMessage: "No recipients" };
    }

    try {
      const { env, status } = await this.post(
        "/sms/send",
        {
          message: body,
          phones: phones.map(toFlashSmsPhone),
          ...(this.cfg.senderId ? { senderId: this.cfg.senderId } : {}),
          ...(opts.scheduledAt ? { scheduledAt: opts.scheduledAt } : {}),
        },
        true,
      );
      if (env.error || status >= 400) {
        return {
          ...empty,
          ok: false,
          errorCode: env.error?.code,
          errorMessage: describeError(env, status),
        };
      }
      return {
        ok: true,
        campaignId: env.data?.id ?? "",
        recipientCount: env.data?.recipientCount ?? 0,
        invalidRecipients: env.data?.invalidRecipients ?? [],
        creditsUsed: env.data?.creditsUsed ?? 0,
        remainingCredits: env.data?.remainingCredits ?? 0,
      };
    } catch (err) {
      return {
        ...empty,
        ok: false,
        errorMessage: `FlashSMS request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * What a send would cost, before sending it. The composer and the CLI both call this
   * so a long message cannot quietly turn into a six-credit-per-person campaign — the
   * 881-character MOMO notice costs 6 credits each, the 160-character version 1.
   */
  async estimate(
    phones: string[],
    body: string,
  ): Promise<FlashSmsEstimate | { error: string }> {
    if (!this.cfg.apiKey) return { error: "FLASHSMS_API_KEY is not set" };
    try {
      const { env, status } = await this.post(
        "/sms/estimate",
        { message: body, phones: phones.map(toFlashSmsPhone) },
        false,
      );
      if (env.error || status >= 400) {
        return { error: describeError(env, status) };
      }
      const d = env.data as unknown as FlashSmsEstimate;
      return {
        partsPerMessage: d.partsPerMessage,
        recipientCount: d.recipientCount,
        creditsNeeded: d.creditsNeeded,
        currentBalance: d.currentBalance,
        canAfford: d.canAfford,
      };
    } catch (err) {
      return {
        error: `FlashSMS request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
