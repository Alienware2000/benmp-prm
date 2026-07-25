import { buildThankYouMessage } from "@/lib/messages";
import { messagingConfiguration } from "@/lib/messaging/configuration";
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

function formatGhsMinor(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  const contextNote = initialMessage
    ? `Prefilled from Giving using the recorded GHS ${formatGhsMinor(amountMinor)} gift. The recipient and amount came from that gift record; review them before sending.`
    : undefined;
  const messaging = messagingConfiguration();

  return (
    <PocShell
      current="/poc/messages"
      title="Messages"
      subtitle="Send a personal WhatsApp message to any valid number or choose people from the partner records."
    >
      <MessagesNav current="number" />
      <DirectMessageClient
        provider={messaging.provider}
        messagingReady={messaging.ready}
        configurationNote={messaging.note}
        initialName={name}
        initialPhone={phone}
        initialMessage={initialMessage}
        contextNote={contextNote}
      />
    </PocShell>
  );
}
