import { MockMessagingAdapter } from "./mock-adapter";
import type { MessagingAdapter, MessagingProvider } from "./types";

function getMessagingProvider(): MessagingProvider {
  const provider = process.env.BENMP_MESSAGING_PROVIDER;

  if (provider === "twilio" || provider === "meta-cloud-api") {
    return provider;
  }

  return "mock";
}

export function getMessagingAdapter(): MessagingAdapter {
  const provider = getMessagingProvider();

  if (provider === "mock") {
    return new MockMessagingAdapter();
  }

  throw new Error(
    `${provider} messaging is not implemented yet. Use the mock adapter for the MVP demo.`,
  );
}

export type {
  MessageCategory,
  MessageSendResult,
  MessagingAdapter,
  MessagingChannel,
  MessagingProvider,
  OutboundMessage,
} from "./types";
