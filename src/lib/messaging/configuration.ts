import type { MessagingProvider } from "./types";

type Environment = Record<string, string | undefined>;

export type MessagingConfiguration = {
  provider: MessagingProvider;
  ready: boolean;
  note?: string;
};

const REQUIRED: Partial<Record<MessagingProvider, string[]>> = {
  wali: ["WALI_API_KEY", "WALI_DEVICE_ID"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_SENDER"],
  "meta-cloud-api": ["META_WHATSAPP_PHONE_NUMBER_ID"],
  infobip: ["INFOBIP_API_KEY", "INFOBIP_BASE_URL", "INFOBIP_WHATSAPP_SENDER"],
  vonage: ["VONAGE_API_KEY", "VONAGE_API_SECRET", "VONAGE_WHATSAPP_SENDER"],
  whatchimp: ["WHATCHIMP_API_TOKEN", "WHATCHIMP_PHONE_NUMBER_ID"],
  // senderId is optional — FlashSMS falls back to the account's first approved ID.
  flashsms: ["FLASHSMS_API_KEY"],
};

export function messagingConfiguration(
  environment: Environment = process.env,
): MessagingConfiguration {
  const configured = environment.BENMP_MESSAGING_PROVIDER;
  const provider: MessagingProvider =
    configured === "twilio" ||
    configured === "meta-cloud-api" ||
    configured === "infobip" ||
    configured === "vonage" ||
    configured === "whatchimp" ||
    configured === "flashsms" ||
    configured === "wali"
      ? configured
      : "mock";

  if (provider === "mock") {
    return {
      provider,
      ready: false,
      note: "This deployment is in demo mode. Set BENMP_MESSAGING_PROVIDER and the provider credentials in its server environment to enable sending.",
    };
  }

  const missing = (REQUIRED[provider] ?? []).filter(
    (name) => !environment[name]?.trim(),
  );
  if (
    provider === "meta-cloud-api" &&
    !environment.META_WHATSAPP_ACCESS_TOKEN?.trim() &&
    !environment.META_WHATSAPP_TOKEN?.trim()
  ) {
    missing.unshift("META_WHATSAPP_ACCESS_TOKEN");
  }
  if (missing.length > 0) {
    return {
      provider,
      ready: false,
      note: `${provider} is selected, but ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} missing from this deployment.`,
    };
  }

  return { provider, ready: true };
}
