/**
 * Twilio messaging adapter — real SMS + WhatsApp sending for the POC.
 *
 * Implements the MessagingAdapter contract so the existing send loop (src/lib/send.ts)
 * dispatches through it unchanged once BENMP_MESSAGING_PROVIDER=twilio.
 *
 * SMS uses a Messaging Service (TWILIO_MESSAGING_SERVICE_SID) if configured, else a plain
 * from-number (TWILIO_SMS_FROM). WhatsApp uses TWILIO_WHATSAPP_SENDER (e.g. the sandbox
 * "whatsapp:+14155238886"). Errors are returned as a failed result, never thrown — matching
 * the mock adapter and what send.ts expects.
 *
 * The Twilio client is created lazily and can be injected (createMessage) so unit tests and
 * CI never make a live API call.
 */

import type { MessageSendResult, MessagingAdapter, OutboundMessage } from "./types";

export type TwilioCreateInput = {
  to: string;
  body: string;
  from?: string;
  messagingServiceSid?: string;
  /** Twilio's API takes a list, but WhatsApp delivers only the first item. */
  mediaUrl?: string[];
};

export type TwilioCreateResult = { sid: string; status: string };

export type TwilioCreateMessage = (input: TwilioCreateInput) => Promise<TwilioCreateResult>;

export type TwilioConfig = {
  accountSid?: string;
  authToken?: string;
  messagingServiceSid?: string;
  smsFrom?: string;
  /** E.164 with the whatsapp: prefix, e.g. "whatsapp:+14155238886". */
  whatsappSender?: string;
  /** Injected sender for tests; defaults to the real Twilio SDK. */
  createMessage?: TwilioCreateMessage;
};

/** Map Twilio's message status to our three-state result. */
export function mapTwilioStatus(status: string): MessageSendResult["status"] {
  const s = status.toLowerCase();
  if (["queued", "accepted", "scheduled", "sending"].includes(s)) return "queued";
  if (["sent", "delivered", "receiving", "received", "read"].includes(s)) return "sent";
  return "failed"; // failed, undelivered, canceled, or anything unrecognized
}

function failed(errorMessage: string): MessageSendResult {
  return { provider: "twilio", providerMessageId: "", status: "failed", errorMessage };
}

export class TwilioMessagingAdapter implements MessagingAdapter {
  provider = "twilio" as const;
  private cfg: TwilioConfig;

  constructor(cfg: TwilioConfig = {}) {
    this.cfg = {
      accountSid: cfg.accountSid ?? process.env.TWILIO_ACCOUNT_SID,
      authToken: cfg.authToken ?? process.env.TWILIO_AUTH_TOKEN,
      messagingServiceSid: cfg.messagingServiceSid ?? process.env.TWILIO_MESSAGING_SERVICE_SID,
      smsFrom: cfg.smsFrom ?? process.env.TWILIO_SMS_FROM,
      whatsappSender: cfg.whatsappSender ?? process.env.TWILIO_WHATSAPP_SENDER,
      createMessage: cfg.createMessage,
    };
  }

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    if (message.channel === "email") {
      return failed("twilio adapter does not send email; use the email adapter");
    }

    const input: TwilioCreateInput = { to: message.to, body: message.body };
    // Twilio pulls the file from this URL at send time; extra URLs are ignored by WhatsApp.
    if (message.mediaUrl) input.mediaUrl = [message.mediaUrl];

    if (message.channel === "whatsapp") {
      if (!this.cfg.whatsappSender) return failed("TWILIO_WHATSAPP_SENDER not set");
      input.to = message.to.startsWith("whatsapp:") ? message.to : `whatsapp:${message.to}`;
      input.from = this.cfg.whatsappSender;
    } else {
      // sms
      if (this.cfg.messagingServiceSid) input.messagingServiceSid = this.cfg.messagingServiceSid;
      else if (this.cfg.smsFrom) input.from = this.cfg.smsFrom;
      else return failed("no SMS sender configured (TWILIO_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM)");
    }

    try {
      const createMessage = this.cfg.createMessage ?? (await this.defaultCreateMessage());
      const result = await createMessage(input);
      return {
        provider: "twilio",
        providerMessageId: result.sid,
        status: mapTwilioStatus(result.status),
      };
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error));
    }
  }

  private async defaultCreateMessage(): Promise<TwilioCreateMessage> {
    const { accountSid, authToken } = this.cfg;
    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set");
    }
    const { default: twilio } = await import("twilio");
    const client = twilio(accountSid, authToken);
    return async (input) => {
      const msg = await client.messages.create({
        to: input.to,
        body: input.body,
        ...(input.messagingServiceSid ? { messagingServiceSid: input.messagingServiceSid } : {}),
        ...(input.from ? { from: input.from } : {}),
        ...(input.mediaUrl ? { mediaUrl: input.mediaUrl } : {}),
      });
      return { sid: msg.sid, status: msg.status };
    };
  }
}
