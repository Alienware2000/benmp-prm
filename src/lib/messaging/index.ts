import { InfobipMessagingAdapter } from "./infobip-adapter";
import { MockMessagingAdapter } from "./mock-adapter";
import { MetaCloudMessagingAdapter } from "./meta-cloud-adapter";
import { TwilioMessagingAdapter } from "./twilio-adapter";
import { VonageMessagingAdapter } from "./vonage-adapter";
import { WaliMessagingAdapter } from "./wali-adapter";
import { WhatChimpMessagingAdapter } from "./whatchimp-adapter";
import type { MessagingAdapter, MessagingProvider } from "./types";

function getMessagingProvider(): MessagingProvider {
  const provider = process.env.BENMP_MESSAGING_PROVIDER;

  if (
    provider === "twilio" ||
    provider === "meta-cloud-api" ||
    provider === "infobip" ||
    provider === "vonage" ||
    provider === "whatchimp" ||
    provider === "wali"
  ) {
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

  if (provider === "infobip") {
    return new InfobipMessagingAdapter();
  }

  if (provider === "vonage") {
    return new VonageMessagingAdapter();
  }

  if (provider === "whatchimp") {
    return new WhatChimpMessagingAdapter();
  }

  if (provider === "wali") {
    return new WaliMessagingAdapter();
  }

  return new MetaCloudMessagingAdapter();
}

export type {
  MessageCategory,
  MessageSendResult,
  MessagingAdapter,
  MessagingChannel,
  MessagingProvider,
  OutboundMessage,
} from "./types";
