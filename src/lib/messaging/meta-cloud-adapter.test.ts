import { describe, expect, it, vi } from "vitest";
import { MetaCloudMessagingAdapter } from "./meta-cloud-adapter";
import type { OutboundMessage } from "./types";

const message = (over: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel: "whatsapp",
  to: "+14753659443",
  body: "Thank you for partnering with BENMP.",
  category: "utility",
  ...over,
});

describe("MetaCloudMessagingAdapter", () => {
  it("sends a free-form WhatsApp message through Meta Graph API", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.123" }] }), {
        status: 200,
      }),
    );
    const adapter = new MetaCloudMessagingAdapter({
      accessToken: "token",
      phoneNumberId: "123456",
      apiVersion: "v23.0",
      fetcher,
    });

    const result = await adapter.send(message());

    expect(fetcher).toHaveBeenCalledWith(
      "https://graph.facebook.com/v23.0/123456/messages",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      messaging_product: "whatsapp",
      to: "14753659443",
      type: "text",
      text: { body: "Thank you for partnering with BENMP." },
    });
    expect(result).toMatchObject({
      provider: "meta-cloud-api",
      providerMessageId: "wamid.123",
      status: "queued",
    });
  });

  it("supports Meta's pre-approved test template", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.template" }] }), {
        status: 200,
      }),
    );
    const adapter = new MetaCloudMessagingAdapter({
      accessToken: "token",
      phoneNumberId: "123456",
      fetcher,
    });

    await adapter.send(message({ templateId: "hello_world" }));

    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    });
  });

  it("returns Meta API errors without throwing or leaking credentials", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "Recipient not allowed", code: 131030 },
          }),
          { status: 400 },
        ),
      );
    const adapter = new MetaCloudMessagingAdapter({
      accessToken: "secret-token",
      phoneNumberId: "123456",
      fetcher,
    });

    const result = await adapter.send(message());

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("Recipient not allowed");
    expect(result.errorMessage).not.toContain("secret-token");
  });

  it("fails closed when credentials are missing or the channel is not WhatsApp", async () => {
    const adapter = new MetaCloudMessagingAdapter({
      accessToken: "",
      phoneNumberId: "",
      fetcher: vi.fn(),
    });
    expect((await adapter.send(message())).status).toBe("failed");
    expect((await adapter.send(message({ channel: "sms" }))).status).toBe(
      "failed",
    );
  });
});
