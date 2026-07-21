import { GiftAcknowledgementClient } from "./gift-acknowledgement-client";
import { GivingNav } from "../giving-nav";
import { PocShell } from "../../nav";

export const dynamic = "force-dynamic";

export default function GiftAcknowledgementTestPage() {
  const configuredProvider = process.env.BENMP_MESSAGING_PROVIDER;
  const provider =
    configuredProvider === "twilio" ||
    configuredProvider === "meta-cloud-api" ||
    configuredProvider === "infobip" ||
    configuredProvider === "vonage"
      ? configuredProvider
      : "mock";

  return (
    <PocShell
      current="/poc/giving"
      title="Giving"
      subtitle="Test the acknowledgement BENMP sends after receiving a gift."
    >
      <GivingNav current="test" />
      <GiftAcknowledgementClient provider={provider} />
    </PocShell>
  );
}
