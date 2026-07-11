import { MockMessagingAdapter } from "./mock-adapter";
import { TwilioMessagingAdapter } from "./twilio-adapter";
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

  if (provider === "twilio") {
    return new TwilioMessagingAdapter();
  }

  if (provider === "mock") {
    return new MockMessagingAdapter();
  }

  throw new Error(
    `${provider} messaging is not implemented yet. Use the mock adapter or twilio.`,
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
