import type {
  MessageSendResult,
  MessagingAdapter,
  OutboundMessage,
} from "./types";

export class MockMessagingAdapter implements MessagingAdapter {
  provider = "mock" as const;

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    return {
      provider: this.provider,
      providerMessageId: `mock_${message.channel}_${Date.now()}`,
      status: "queued",
    };
  }
}
