import { buildThankYouMessage } from "@/lib/messages";
import type { MessagingProvider } from "@/lib/messaging/types";
import { PartnerWorkspace } from "../directory/partner-workspace";
import { PocShell } from "../nav";
import { DirectMessageClient } from "./direct-message-client";
import { MessagesNav } from "./messages-nav";

export const dynamic = "force-dynamic";

type MessagesSearchParams = Promise<{
  q?: string;
  branch?: string;
  page?: string;
  mode?: string;
  name?: string;
  phone?: string;
  amountMinor?: string;
  template?: string;
}>;

function configuredProvider(): MessagingProvider {
  const provider = process.env.BENMP_MESSAGING_PROVIDER;
  return provider === "twilio" ||
    provider === "meta-cloud-api" ||
    provider === "infobip" ||
    provider === "vonage" ||
    provider === "whatchimp" ||
    provider === "wali"
    ? provider
    : "mock";
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: MessagesSearchParams;
}) {
  const sp = await searchParams;
  if (sp.mode === "partners") {
    return <PartnerWorkspace searchParams={searchParams} />;
  }

  const name = (sp.name ?? "").trim();
  const phone = (sp.phone ?? "").trim();
  const amountMinor = Number(sp.amountMinor);
  const initialMessage =
    sp.template === "thank-you" &&
    Number.isSafeInteger(amountMinor) &&
    amountMinor > 0
      ? buildThankYouMessage(name, amountMinor)
      : "";

  return (
    <PocShell
      current="/poc/messages"
      title="Messages"
      subtitle="Send a personal WhatsApp message to any valid number or choose people from the partner records."
    >
      <MessagesNav current="number" />
      <DirectMessageClient
        provider={configuredProvider()}
        initialName={name}
        initialPhone={phone}
        initialMessage={initialMessage}
      />
    </PocShell>
  );
}
