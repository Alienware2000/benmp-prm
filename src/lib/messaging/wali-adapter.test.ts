import { describe, expect, it, vi } from "vitest";
import { WaliMessagingAdapter } from "./wali-adapter";
import type { OutboundMessage } from "./types";

const message = (over: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel: "whatsapp",
  to: "+14753659443",
  body: "Thank you for partnering with BENMP.",
  category: "utility",
  partnerId: "partner-123",
  ...over,
});

describe("WaliMessagingAdapter", () => {
  it("queues a WhatsApp text message through the configured BENMP number", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "wali-message-123", status: "queued" }),
          { status: 201 },
        ),
      );
    const adapter = new WaliMessagingAdapter({
      apiKey: "private-key",
      deviceId: "6a6366b327ce9822275631c2",
      fetcher,
    });

    const result = await adapter.send(
      message({ to: "whatsapp:+1 (475) 365-9443" }),
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.wali.chat/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Token: "private-key" }),
      }),
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      phone: "+14753659443",
      device: "6a6366b327ce9822275631c2",
      enqueue: "always",
      message: "Thank you for partnering with BENMP.",
      reference: "partner-123",
    });
    expect(result).toEqual({
      provider: "wali",
      providerMessageId: "wali-message-123",
      status: "queued",
    });
  });

  it("maps a processed Wali response to sent", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "wali-message-processed", status: "processed" }),
          { status: 201 },
        ),
      );
    const adapter = new WaliMessagingAdapter({
      apiKey: "private-key",
      deviceId: "6a6366b327ce9822275631c2",
      fetcher,
    });

    expect(await adapter.send(message())).toMatchObject({ status: "sent" });
  });

  it("sends an approved template with personalized variables", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "wali-template", status: "queued" }), {
        status: 201,
      }),
    );
    const adapter = new WaliMessagingAdapter({
      apiKey: "private-key",
      deviceId: "6a6366b327ce9822275631c2",
      fetcher,
    });

    await adapter.send(
      message({
        templateId: "gift_acknowledgement",
        metadata: {
          templateLanguage: "en_US",
          variable2: "GHS 60",
          variable1: "David",
          ignored: "value",
        },
      }),
    );

    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      phone: "+14753659443",
      device: "6a6366b327ce9822275631c2",
      enqueue: "always",
      template: {
        name: "gift_acknowledgement",
        language: "en_US",
        body: [
          { name: "1", value: "David" },
          { name: "2", value: "GHS 60" },
        ],
      },
      reference: "partner-123",
    });
  });

  it("sends one public image attachment with its caption", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "wali-media", status: "queued" }), {
        status: 201,
      }),
    );
    const adapter = new WaliMessagingAdapter({
      apiKey: "private-key",
      deviceId: "6a6366b327ce9822275631c2",
      fetcher,
    });

    await adapter.send(
      message({
        mediaUrl: "https://cdn.example.org/crusade.jpg",
        mediaType: "image/jpeg",
        mediaFilename: "crusade.jpg",
      }),
    );

    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      media: {
        url: "https://cdn.example.org/crusade.jpg",
        message: "Thank you for partnering with BENMP.",
        filename: "crusade.jpg",
      },
    });
  });

  it("returns provider errors without leaking the API key", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Template is not approved" }), {
        status: 400,
      }),
    );
    const adapter = new WaliMessagingAdapter({
      apiKey: "private-key",
      deviceId: "6a6366b327ce9822275631c2",
      fetcher,
    });

    const result = await adapter.send(message());

    expect(result).toMatchObject({
      provider: "wali",
      status: "failed",
      errorMessage: "Wali: Template is not approved",
    });
    expect(result.errorMessage).not.toContain("private-key");
  });

  it("turns a stale device error into a staff-actionable message", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message:
            "Device is invalid or does not exist. Specify the proper target device ID.",
        }),
        { status: 400 },
      ),
    );
    const adapter = new WaliMessagingAdapter({
      apiKey: "private-key",
      deviceId: "stale-device",
      fetcher,
    });

    expect(await adapter.send(message())).toMatchObject({
      status: "failed",
      errorMessage: expect.stringContaining(
        "BENMP WhatsApp sender is disconnected",
      ),
    });
  });

  it("fails before the network call for unsupported or incomplete sends", async () => {
    const fetcher = vi.fn();

    expect(
      (
        await new WaliMessagingAdapter({
          apiKey: "private-key",
          deviceId: "6a6366b327ce9822275631c2",
          fetcher,
        }).send(message({ channel: "sms" }))
      ).status,
    ).toBe("failed");
    expect(
      (
        await new WaliMessagingAdapter({
          apiKey: "",
          deviceId: "",
          fetcher,
        }).send(message())
      ).errorMessage,
    ).toContain("WALI_API_KEY");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
