import { describe, it, expect, vi } from "vitest";
import { sendPlanned } from "./send";
import type { PlannedMessage } from "./messages";
import type {
  MessagingAdapter,
  MessageSendResult,
  OutboundMessage,
} from "./messaging/types";

const pm = (over: Partial<PlannedMessage>): PlannedMessage => ({
  kind: "thank_you",
  to: "+233244000001",
  name: "Kofi",
  body: "Hi Kofi, thank you.",
  partnerRef: "reg_0",
  channel: "whatsapp",
  category: "utility",
  sendable: true,
  ...over,
});

const messages: PlannedMessage[] = [
  pm({ partnerRef: "reg_0", to: "+233244000001" }), // sendable
  pm({ kind: "reminder", partnerRef: "reg_5", to: "+233244555000" }), // sendable
  pm({ partnerRef: "reg_2", to: null, sendable: false }), // no phone
  pm({ partnerRef: "reg_9", to: "+233209999999" }), // sendable but opted out
];

function okAdapter(): MessagingAdapter {
  return {
    provider: "mock",
    send: vi.fn(async (m: OutboundMessage): Promise<MessageSendResult> => ({
      provider: "mock",
      providerMessageId: `mock_${m.to}`,
      status: "queued",
    })),
  };
}

describe("sendPlanned", () => {
  it("sends sendable messages, skips un-sendable and opted-out, and tallies", async () => {
    const adapter = okAdapter();
    const report = await sendPlanned(messages, {
      adapter,
      optedOut: new Set(["+233209999999"]),
    });

    expect(report.total).toBe(4);
    expect(report.queued).toBe(2); // reg_0 + reg_5
    expect(report.skipped).toBe(2); // no-phone + opted-out
    expect(report.failed).toBe(0);
    // the adapter was only called for the two sendable, non-opted-out messages
    expect(adapter.send).toHaveBeenCalledTimes(2);

    const noPhone = report.outcomes.find((o) => o.partnerRef === "reg_2")!;
    expect(noPhone.status).toBe("skipped");
    expect(noPhone.reason).toMatch(/phone/i);

    const optedOut = report.outcomes.find((o) => o.partnerRef === "reg_9")!;
    expect(optedOut.status).toBe("skipped");
    expect(optedOut.reason).toMatch(/opt/i);
  });

  it("records a provider failure without throwing", async () => {
    const throwing: MessagingAdapter = {
      provider: "mock",
      send: vi.fn(async () => {
        throw new Error("provider down");
      }),
    };
    const report = await sendPlanned([messages[0]], { adapter: throwing });
    expect(report.failed).toBe(1);
    expect(report.queued).toBe(0);
    expect(report.outcomes[0].status).toBe("failed");
    expect(report.outcomes[0].reason).toContain("provider down");
  });

  it("treats an adapter 'failed' result as failed (not queued)", async () => {
    const failed: MessagingAdapter = {
      provider: "mock",
      send: vi.fn(async () => ({
        provider: "mock" as const,
        providerMessageId: "x",
        status: "failed" as const,
        errorMessage: "bad number",
      })),
    };
    const report = await sendPlanned([messages[0]], { adapter: failed });
    expect(report.failed).toBe(1);
    expect(report.outcomes[0].reason).toBe("bad number");
  });
});
