import { describe, expect, it, vi } from "vitest";
import { InfobipMessagingAdapter } from "./infobip-adapter";
import type { OutboundMessage } from "./types";

const message = (over: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel: "whatsapp",
  to: "+14753659443",
  body: "Thank you for partnering with BENMP.",
  category: "utility",
  ...over,
});

describe("InfobipMessagingAdapter", () => {
  it("queues a free-form WhatsApp message through Infobip", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messageId: "infobip-message-123",
          status: {
            groupName: "PENDING",
            name: "PENDING_ENROUTE",
          },
        }),
        { status: 200 },
      ),
    );
    const adapter = new InfobipMessagingAdapter({
      apiKey: "api-key",
      baseUrl: "https://example.api.infobip.com/",
      whatsappSender: "447860099299",
      fetcher,
    });

    const result = await adapter.send(message({ to: "whatsapp:+14753659443" }));

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.api.infobip.com/whatsapp/1/message/text",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: "App api-key" });
    expect(JSON.parse(String(init.body))).toEqual({
      from: "447860099299",
      to: "14753659443",
      content: { text: "Thank you for partnering with BENMP." },
    });
    expect(result).toEqual({
      provider: "infobip",
      providerMessageId: "infobip-message-123",
      status: "queued",
    });
  });

  it("maps a delivered response to sent", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messageId: "delivered-123",
          status: { groupName: "DELIVERED" },
        }),
        { status: 200 },
      ),
    );
    const adapter = new InfobipMessagingAdapter({
      apiKey: "api-key",
      baseUrl: "example.api.infobip.com",
      whatsappSender: "447860099299",
      fetcher,
    });

    expect(await adapter.send(message())).toMatchObject({ status: "sent" });
  });

  it("returns API errors without leaking credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          requestError: {
            serviceException: { text: "Destination is not verified" },
          },
        }),
        { status: 400 },
      ),
    );
    const adapter = new InfobipMessagingAdapter({
      apiKey: "secret-key",
      baseUrl: "example.api.infobip.com",
      whatsappSender: "447860099299",
      fetcher,
    });

    const result = await adapter.send(message());

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("Destination is not verified");
    expect(result.errorMessage).not.toContain("secret-key");
  });

  it("fails closed for rejected statuses, unsupported templates, and missing configuration", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messageId: "rejected-123",
          status: { groupName: "REJECTED", description: "Message rejected" },
        }),
        { status: 200 },
      ),
    );
    const configured = new InfobipMessagingAdapter({
      apiKey: "api-key",
      baseUrl: "example.api.infobip.com",
      whatsappSender: "447860099299",
      fetcher,
    });
    const missing = new InfobipMessagingAdapter({
      apiKey: "",
      baseUrl: "",
      whatsappSender: "",
      fetcher,
    });

    expect((await configured.send(message())).status).toBe("failed");
    expect(
      (await configured.send(message({ templateId: "welcome" }))).status,
    ).toBe("failed");
    expect((await missing.send(message())).status).toBe("failed");
    expect((await configured.send(message({ channel: "sms" }))).status).toBe(
      "failed",
    );
  });
});
