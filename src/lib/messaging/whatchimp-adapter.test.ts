import { describe, expect, it, vi } from "vitest";
import { WhatChimpMessagingAdapter } from "./whatchimp-adapter";
import type { OutboundMessage } from "./types";

const message = (over: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel: "whatsapp",
  to: "+14753659443",
  body: "Thank you for partnering with BENMP.",
  category: "utility",
  ...over,
});

describe("WhatChimpMessagingAdapter", () => {
  it("queues a 24-hour WhatsApp text message", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "1",
          wa_message_id: "wamid.whatchimp-123",
          message: "Message sent successfully.",
        }),
        { status: 200 },
      ),
    );
    const adapter = new WhatChimpMessagingAdapter({
      apiToken: "api-token",
      phoneNumberId: "phone-id",
      fetcher,
    });

    const result = await adapter.send(message({ to: "whatsapp:+14753659443" }));

    expect(fetcher).toHaveBeenCalledWith(
      "https://app.whatchimp.com/api/v1/whatsapp/send",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = init.body as URLSearchParams;
    expect(Object.fromEntries(body.entries())).toEqual({
      apiToken: "api-token",
      phone_number_id: "phone-id",
      phone_number: "14753659443",
      message: "Thank you for partnering with BENMP.",
    });
    expect(result).toEqual({
      provider: "whatchimp",
      providerMessageId: "wamid.whatchimp-123",
      status: "queued",
    });
  });

  it("sends an approved template with personalized variables", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 1, wa_message_id: "wamid.template" }),
          { status: 200 },
        ),
      );
    const adapter = new WhatChimpMessagingAdapter({
      apiToken: "api-token",
      phoneNumberId: "phone-id",
      fetcher,
    });

    await adapter.send(
      message({
        templateId: "gift_acknowledgement",
        metadata: {
          templateLanguage: "en_US",
          variable1: "David",
          variable2: "GHS 60",
          ignored: "value",
        },
      }),
    );

    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(
      Object.fromEntries((init.body as URLSearchParams).entries()),
    ).toEqual({
      apiToken: "api-token",
      phone_number_id: "phone-id",
      phone_number: "14753659443",
      template_name: "gift_acknowledgement",
      language_code: "en_US",
      variable1: "David",
      variable2: "GHS 60",
    });
  });

  it("treats WhatChimp status zero as a failed send", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "0",
          message: "Use a template outside the 24-hour window",
        }),
        { status: 200 },
      ),
    );
    const adapter = new WhatChimpMessagingAdapter({
      apiToken: "private-api-token",
      phoneNumberId: "phone-id",
      fetcher,
    });

    const result = await adapter.send(message());

    expect(result).toMatchObject({
      provider: "whatchimp",
      status: "failed",
      errorMessage: "WhatChimp: Use a template outside the 24-hour window",
    });
    expect(result.errorMessage).not.toContain("private-api-token");
  });

  it("fails before the network call without credentials", async () => {
    const fetcher = vi.fn();
    const adapter = new WhatChimpMessagingAdapter({
      apiToken: "",
      phoneNumberId: "",
      fetcher,
    });

    const result = await adapter.send(message());

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.errorMessage).toContain("WHATCHIMP_API_TOKEN");
  });

  it("rejects unsupported channels and attachments", async () => {
    const fetcher = vi.fn();
    const adapter = new WhatChimpMessagingAdapter({ fetcher });

    expect((await adapter.send(message({ channel: "sms" }))).status).toBe(
      "failed",
    );
    expect(
      (
        await adapter.send(
          message({ mediaUrl: "https://cdn.example.org/crusade.jpg" }),
        )
      ).status,
    ).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
