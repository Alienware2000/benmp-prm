import { describe, expect, it, vi } from "vitest";
import { VonageMessagingAdapter } from "./vonage-adapter";
import type { OutboundMessage } from "./types";

const message = (over: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel: "whatsapp",
  to: "+14753659443",
  body: "Thank you for partnering with BENMP.",
  category: "utility",
  ...over,
});

describe("VonageMessagingAdapter", () => {
  it("queues a WhatsApp message through the Vonage sandbox", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message_uuid: "vonage-message-123" }), {
        status: 202,
      }),
    );
    const adapter = new VonageMessagingAdapter({
      apiKey: "api-key",
      apiSecret: "api-secret",
      whatsappSender: "14157386102",
      fetcher,
    });

    const result = await adapter.send(message({ to: "whatsapp:+14753659443" }));

    expect(fetcher).toHaveBeenCalledWith(
      "https://messages-sandbox.nexmo.com/v1/messages",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("api-key:api-secret").toString("base64")}`,
    });
    expect(JSON.parse(String(init.body))).toEqual({
      from: "14157386102",
      to: "14753659443",
      channel: "whatsapp",
      message_type: "text",
      text: "Thank you for partnering with BENMP.",
    });
    expect(result).toEqual({
      provider: "vonage",
      providerMessageId: "vonage-message-123",
      status: "queued",
    });
  });

  it("sends an image with the personalized message as its caption", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message_uuid: "image-123" }), {
        status: 202,
      }),
    );
    const adapter = new VonageMessagingAdapter({
      apiKey: "api-key",
      apiSecret: "api-secret",
      whatsappSender: "14157386102",
      fetcher,
    });

    await adapter.send(
      message({
        mediaUrl: "https://cdn.example.org/crusade.jpg",
        mediaType: "image/jpeg",
      }),
    );

    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      message_type: "image",
      image: {
        url: "https://cdn.example.org/crusade.jpg",
        caption: "Thank you for partnering with BENMP.",
      },
    });
  });

  it("returns provider errors without leaking credentials", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "Bad Request",
            detail: "Number is not allow-listed",
          }),
          { status: 400 },
        ),
      );
    const adapter = new VonageMessagingAdapter({
      apiKey: "private-api-key",
      apiSecret: "private-api-secret",
      whatsappSender: "14157386102",
      fetcher,
    });

    const result = await adapter.send(message());

    expect(result).toMatchObject({
      provider: "vonage",
      status: "failed",
      errorMessage: "Vonage: Number is not allow-listed",
    });
    expect(result.errorMessage).not.toContain("private-api-secret");
  });

  it("fails before the network call when credentials are missing", async () => {
    const fetcher = vi.fn();
    const adapter = new VonageMessagingAdapter({
      apiKey: "",
      apiSecret: "",
      whatsappSender: "",
      fetcher,
    });

    const result = await adapter.send(message());

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "failed" });
    expect(result.errorMessage).toContain("VONAGE_API_KEY");
  });

  it("rejects non-WhatsApp channels", async () => {
    const fetcher = vi.fn();
    const adapter = new VonageMessagingAdapter({ fetcher });

    const result = await adapter.send(message({ channel: "sms" }));

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "failed" });
  });
});
