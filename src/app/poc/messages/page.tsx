import { buildThankYouMessage } from "@/lib/messages";
import { messagingRuntimeConfiguration } from "@/lib/messaging/runtime-configuration";
import { headlineAnswers } from "@/lib/poc/answers";
import { audienceCounts } from "@/lib/poc/audiences";
import { loadReconciliation } from "@/lib/poc/db";
import { countDirectoryPartners } from "@/lib/poc/directory";
import { reportingPeriod } from "@/lib/poc/reporting-period";
import {
  ArrowLeft,
  BellRing,
  ChevronRight,
  HeartHandshake,
  Megaphone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { MessageCenter } from "../message-center";
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
  task?: string;
}>;

function TaskCard({
  href,
  title,
  description,
  detail,
  Icon,
}: {
  href: string;
  title: string;
  description: string;
  detail?: string;
  Icon: typeof HeartHandshake;
}) {
  return (
    <Link
      href={href}
      className="group grid min-h-[112px] grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-surface p-4 transition hover:border-success/40 hover:bg-background"
    >
      <span className="grid h-11 w-11 place-items-center rounded-md bg-success/10 text-success">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
        {detail && (
          <span className="mt-2 block text-[11px] font-semibold text-success">
            {detail}
          </span>
        )}
      </span>
      <ChevronRight
        className="mt-3 h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-success"
        aria-hidden
      />
    </Link>
  );
}

function formatGhsMinor(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const THANK_MESSAGE =
  "Hi {name}, thank you for {amount} to BENMP. Your partnership means so much to us. God richly bless you!";
const REMINDER_MESSAGE =
  "Hi {name}, this is a gentle reminder about your BENMP partnership gift. Please send it by MoMo whenever you are ready. Thank you and God bless you!";
const UPDATE_MESSAGE =
  "Hi {name}, we would like to share an update from BENMP and the Healing Jesus Campaign. Thank you for staying connected with us.";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: MessagesSearchParams;
}) {
  const sp = await searchParams;
  const messaging = await messagingRuntimeConfiguration();
  if (sp.mode !== "number") {
    const [reconciliation, allPartnerCount] = await Promise.all([
      loadReconciliation(),
      countDirectoryPartners(),
    ]);
    const answers = headlineAnswers(reconciliation);
    const counts = audienceCounts(reconciliation, allPartnerCount);
    const period = reportingPeriod(reconciliation);
    const task =
      sp.task === "thank" ||
      sp.task === "remind" ||
      sp.task === "update" ||
      sp.mode === "partners"
        ? sp.mode === "partners"
          ? "update"
          : sp.task
        : null;
    if (task) {
      const initialAudience =
        task === "thank" ? "paid" : task === "remind" ? "unpaid" : "everyone";
      const initialMessage =
        task === "thank"
          ? THANK_MESSAGE
          : task === "remind"
            ? REMINDER_MESSAGE
            : UPDATE_MESSAGE;
      return (
        <PocShell
          current="/poc/messages"
          title="Messages"
          subtitle="Choose the people, review the wording and confirm before anything is sent."
        >
          <MessagesNav current="partners" />
          <Link
            href="/poc/messages"
            className="mb-3 flex min-h-9 w-fit items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-foreground transition hover:border-success/40 hover:bg-background"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Message choices
          </Link>
          <MessageCenter
            initialAudience={initialAudience}
            counts={counts}
            initialMessage={initialMessage}
            provider={messaging.provider}
            messagingReady={messaging.ready}
            configurationNote={messaging.note}
            periodLabel={period.label}
          />
        </PocShell>
      );
    }
    return (
      <PocShell
        current="/poc/messages"
        title="Messages"
        subtitle="Choose what you want to do. The platform will prepare the right people and help with the message."
      >
        <MessagesNav current="partners" />
        <section>
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground">
              What would you like to do?
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Choose one task to begin. You can review every recipient and edit
              every message before sending.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TaskCard
              href="/poc/messages?task=thank"
              title="Thank people who gave"
              description="Prepare personal acknowledgements using each person's recorded name and amount."
              detail={`${answers.paidCount.toLocaleString("en-US")} people gave · ${period.compactLabel}`}
              Icon={HeartHandshake}
            />
            <TaskCard
              href="/poc/messages?task=remind"
              title="Send a reminder"
              description={`Gently contact registered partners with no recorded gift from ${period.label}.`}
              detail={`${answers.unpaidCount.toLocaleString("en-US")} people have no gift recorded`}
              Icon={BellRing}
            />
            <TaskCard
              href="/poc/messages?task=update"
              title="Send a ministry update"
              description="Choose all partners, recent givers, repeat givers, the top 20 or another prepared group."
              detail="Group filters, editable drafts and attachments"
              Icon={Megaphone}
            />
            <TaskCard
              href="/poc/messages?mode=number"
              title="Message one person"
              description="Enter any valid WhatsApp number for a personal message."
              Icon={UserRound}
            />
          </div>
        </section>
      </PocShell>
    );
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
        initialAmountMinor={
          Number.isSafeInteger(amountMinor) && amountMinor > 0
            ? amountMinor
            : undefined
        }
        contextNote={contextNote}
      />
    </PocShell>
  );
}
