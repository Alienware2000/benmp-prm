import { describe, expect, it, vi } from "vitest";
import { FlashSmsMessagingAdapter, toFlashSmsPhone } from "./flashsms-adapter";
import type { OutboundMessage } from "./types";

const smsMsg = (over: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel: "sms",
  to: "+233241234567",
  body: "Test",
  category: "utility",
  ...over,
});

/** Fake fetch returning one canned envelope, recording what it was called with. */
function fetcherOf(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

const adapterWith = (fetcher: typeof fetch, over = {}) =>
  new FlashSmsMessagingAdapter({
    apiKey: "bms_live_test",
    fetcher,
    idempotencyKey: () => "fixed-uuid",
    ...over,
  });

const ACCEPTED = {
  data: {
    id: "msg_01HV",
    status: "PENDING",
    recipientCount: 1,
    invalidRecipients: [],
    creditsUsed: 1,
    remainingCredits: 998,
  },
  meta: { requestId: "r1" },
};

describe("toFlashSmsPhone", () => {
  it("strips the leading + that our contacts are stored with", () => {
    // FlashSMS accepts 0XXXXXXXXX or 233XXXXXXXXX — a "+" is not an accepted form.
    expect(toFlashSmsPhone("+233241234567")).toBe("233241234567");
  });

  it("strips a whatsapp: prefix and any punctuation", () => {
    expect(toFlashSmsPhone("whatsapp:+233 24-123 4567")).toBe("233241234567");
  });
});

describe("FlashSmsMessagingAdapter.send", () => {
  it("treats a 202 PENDING as queued, not failed", async () => {
    // Every provider here reports success asynchronously; "queued" is the success case.
    const result = await adapterWith(fetcherOf(202, ACCEPTED)).send(smsMsg());
    expect(result).toMatchObject({
      provider: "flashsms",
      providerMessageId: "msg_01HV",
      status: "queued",
    });
  });

  it("sends an Idempotency-Key so a retry cannot double-charge", async () => {
    const fetcher = fetcherOf(202, ACCEPTED);
    await adapterWith(fetcher).send(smsMsg());
    const [, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(init.headers["Idempotency-Key"]).toBe("fixed-uuid");
    expect(init.headers.Authorization).toBe("Bearer bms_live_test");
  });

  it("posts the phone without a + and includes the sender id when set", async () => {
    const fetcher = fetcherOf(202, ACCEPTED);
    await adapterWith(fetcher, { senderId: "BENMP" }).send(smsMsg());
    const [, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      phones: ["233241234567"],
      senderId: "BENMP",
    });
  });

  it("surfaces a typed API error with its code", async () => {
    const result = await adapterWith(
      fetcherOf(402, {
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: "Account does not have enough SMS credits",
        },
      }),
    ).send(smsMsg());
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("INSUFFICIENT_CREDITS");
  });

  it("refuses non-SMS channels rather than sending the wrong thing", async () => {
    const result = await adapterWith(fetcherOf(202, ACCEPTED)).send(
      smsMsg({ channel: "whatsapp" }),
    );
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("only sends SMS");
  });

  it("fails cleanly when the key is missing instead of calling the API", async () => {
    const fetcher = fetcherOf(202, ACCEPTED);
    const result = await new FlashSmsMessagingAdapter({
      apiKey: "",
      fetcher,
    }).send(smsMsg());
    expect(result.status).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never throws on a network error", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("socket hang up");
    }) as unknown as typeof fetch;
    const result = await adapterWith(fetcher).send(smsMsg());
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("socket hang up");
  });
});

describe("FlashSmsMessagingAdapter.sendBulk", () => {
  it("posts every recipient in ONE request and reports credits", async () => {
    const fetcher = fetcherOf(202, {
      data: {
        id: "msg_bulk",
        recipientCount: 3,
        invalidRecipients: ["123"],
        creditsUsed: 6,
        remainingCredits: 17245,
      },
    });
    const result = await adapterWith(fetcher).sendBulk(
      ["+233241234567", "+233201234567", "123"],
      "Hello",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      campaignId: "msg_bulk",
      recipientCount: 3,
      invalidRecipients: ["123"],
      creditsUsed: 6,
      remainingCredits: 17245,
    });
  });

  it("reports the error code so INSUFFICIENT_CREDITS can be handled", async () => {
    const result = await adapterWith(
      fetcherOf(402, {
        error: { code: "INSUFFICIENT_CREDITS", message: "not enough" },
      }),
    ).sendBulk(["+233241234567"], "Hello");
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("INSUFFICIENT_CREDITS");
  });

  it("does not call the API with an empty recipient list", async () => {
    const fetcher = fetcherOf(202, ACCEPTED);
    const result = await adapterWith(fetcher).sendBulk([], "Hello");
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("FlashSmsMessagingAdapter.estimate", () => {
  it("returns the cost without an Idempotency-Key (it creates nothing)", async () => {
    const fetcher = fetcherOf(200, {
      data: {
        partsPerMessage: 6,
        recipientCount: 1,
        creditsNeeded: 6,
        currentBalance: 17251,
        canAfford: true,
      },
    });
    const result = await adapterWith(fetcher).estimate(
      ["+233241234567"],
      "long message",
    );
    expect(result).toMatchObject({ partsPerMessage: 6, creditsNeeded: 6 });
    const [, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(init.headers["Idempotency-Key"]).toBeUndefined();
  });
});
