import { describe, it, expect, vi } from "vitest";
import { TwilioMessagingAdapter, mapTwilioStatus } from "./twilio-adapter";
import type { OutboundMessage } from "./types";

const smsMsg = (over: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel: "sms",
  to: "+233244123456",
  body: "Thank you Ama for your partnership.",
  category: "utility",
  ...over,
});

describe("mapTwilioStatus", () => {
  it("maps queued-ish states to queued", () => {
    expect(mapTwilioStatus("queued")).toBe("queued");
    expect(mapTwilioStatus("accepted")).toBe("queued");
    expect(mapTwilioStatus("sending")).toBe("queued");
  });
  it("maps delivered-ish states to sent", () => {
    expect(mapTwilioStatus("sent")).toBe("sent");
    expect(mapTwilioStatus("delivered")).toBe("sent");
  });
  it("maps failures and unknowns to failed", () => {
    expect(mapTwilioStatus("failed")).toBe("failed");
    expect(mapTwilioStatus("undelivered")).toBe("failed");
    expect(mapTwilioStatus("whatever")).toBe("failed");
  });
});

describe("TwilioMessagingAdapter", () => {
  it("sends SMS via a Messaging Service when configured", async () => {
    const createMessage = vi.fn().mockResolvedValue({ sid: "SM123", status: "queued" });
    const adapter = new TwilioMessagingAdapter({ messagingServiceSid: "MG999", createMessage });
    const result = await adapter.send(smsMsg());
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+233244123456", messagingServiceSid: "MG999" }),
    );
    expect(result).toMatchObject({ provider: "twilio", providerMessageId: "SM123", status: "queued" });
  });

  it("sends SMS via a from-number when no Messaging Service is set", async () => {
    const createMessage = vi.fn().mockResolvedValue({ sid: "SM124", status: "sent" });
    const adapter = new TwilioMessagingAdapter({ smsFrom: "+15005550006", createMessage });
    await adapter.send(smsMsg());
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ from: "+15005550006" }),
    );
  });

  it("prefixes whatsapp: on both to and from for WhatsApp", async () => {
    const createMessage = vi.fn().mockResolvedValue({ sid: "SM125", status: "queued" });
    const adapter = new TwilioMessagingAdapter({
      whatsappSender: "whatsapp:+14155238886",
      createMessage,
    });
    await adapter.send(smsMsg({ channel: "whatsapp" }));
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "whatsapp:+233244123456", from: "whatsapp:+14155238886" }),
    );
  });

  it("returns failed (does not throw) when the SMS sender is unconfigured", async () => {
    const adapter = new TwilioMessagingAdapter({ createMessage: vi.fn() });
    const result = await adapter.send(smsMsg());
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/SMS sender/i);
  });

  it("returns failed when WhatsApp sender is unconfigured", async () => {
    const adapter = new TwilioMessagingAdapter({ createMessage: vi.fn() });
    const result = await adapter.send(smsMsg({ channel: "whatsapp" }));
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/TWILIO_WHATSAPP_SENDER/);
  });

  it("does not send email", async () => {
    const createMessage = vi.fn();
    const adapter = new TwilioMessagingAdapter({ smsFrom: "+15005550006", createMessage });
    const result = await adapter.send(smsMsg({ channel: "email" }));
    expect(result.status).toBe("failed");
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("turns a Twilio API error into a failed result, never throws", async () => {
    const createMessage = vi.fn().mockRejectedValue(new Error("21608 unverified number"));
    const adapter = new TwilioMessagingAdapter({ smsFrom: "+15005550006", createMessage });
    const result = await adapter.send(smsMsg());
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/21608/);
  });
});
