import { buildThankYouMessage } from "@/lib/messages";
import { headlineAnswers } from "@/lib/poc/answers";
import { audienceCounts } from "@/lib/poc/audiences";
import {
  countDirectoryPartnersCached,
  countLegacyGhanaContactsCached,
  legacyBatchPlanCached,
  loadReconciliationCached,
  messagingRuntimeConfigurationCached,
} from "@/lib/poc/cached-data";
import {
  filterReconciliationByPeriod,
  reportingPeriod,
} from "@/lib/poc/reporting-period";
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
import { PeriodFilter } from "../period-filter";
import { DirectMessageClient } from "./direct-message-client";
import { MessagesNav } from "./messages-nav";

export const dynamic = "force-dynamic";

type MessagesSearchParams = Promise<{
  mode?: string;
  name?: string;
  phone?: string;
  amountMinor?: string;
  template?: string;
  task?: string;
  from?: string;
  to?: string;
}>;

function withPeriod(
  path: string,
  from: string,
  to: string,
  values: Record<string, string> = {},
): string {
  const params = new URLSearchParams(values);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

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
      className="group grid min-h-[116px] grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
    >
      <span className="grid h-11 w-11 place-items-center rounded-md bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
        {detail && (
          <span className="mt-2 block text-[11px] font-semibold text-brand">
            {detail}
          </span>
        )}
      </span>
      <ChevronRight
        className="mt-3 h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand"
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
  const from = (sp.from ?? "").slice(0, 10);
  const to = (sp.to ?? "").slice(0, 10);

  if (sp.mode === "number") {
    const messaging = await messagingRuntimeConfigurationCached();
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
      ? `Prefilled from Giving using the recorded GHS ${formatGhsMinor(amountMinor)} gift. Review the recipient and amount before sending.`
      : undefined;
    return (
      <PocShell
        title="Messages"
        subtitle="Send a personal WhatsApp message to any valid international number."
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

  const [
    completeReconciliation,
    allPartnerCount,
    legacyGhanaCount,
    legacyBatchPlan,
  ] = await Promise.all([
    loadReconciliationCached(),
    countDirectoryPartnersCached(),
    countLegacyGhanaContactsCached(),
    legacyBatchPlanCached(),
  ]);
  const availablePeriod = reportingPeriod(completeReconciliation);
  const reconciliation = filterReconciliationByPeriod(completeReconciliation, {
    from,
    to,
  });
  const answers = headlineAnswers(reconciliation);
  const counts = audienceCounts(
    reconciliation,
    allPartnerCount,
    legacyGhanaCount,
  );
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
  const toolbar = (
    <PeriodFilter
      availableStart={availablePeriod.start}
      availableEnd={availablePeriod.end}
      currentFrom={from}
      currentTo={to}
    />
  );

  if (task) {
    const messaging = await messagingRuntimeConfigurationCached();
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
        title="Messages"
        subtitle="Choose a group, edit the message, add media if needed, then review before sending."
        toolbar={toolbar}
      >
        <MessagesNav current="partners" />
        <Link
          href={withPeriod("/poc/messages", from, to)}
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-foreground shadow-sm transition hover:border-brand/30 hover:bg-background"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All message actions
        </Link>
        <MessageCenter
          initialAudience={initialAudience}
          counts={counts}
          initialMessage={initialMessage}
          provider={messaging.provider}
          messagingReady={messaging.ready}
          configurationNote={messaging.note}
          periodLabel={period.label}
          periodFrom={from}
          periodTo={to}
          legacyBatches={legacyBatchPlan.batches}
        />
      </PocShell>
    );
  }

  return (
    <PocShell
      title="Messages"
      subtitle="Choose a purpose. The platform prepares the right group, and every message remains editable before sending."
      toolbar={toolbar}
    >
      <MessagesNav current="partners" />
      <section>
        <div className="mb-3">
          <h2 className="text-base font-bold">What would you like to do?</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Gift-based actions use the reporting period selected above.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TaskCard
            href={withPeriod("/poc/messages", from, to, { task: "thank" })}
            title="Thank people who gave"
            description="Prepare personal acknowledgements using each person's recorded name and amount."
            detail={`${answers.paidCount.toLocaleString("en-US")} people gave · ${period.compactLabel}`}
            Icon={HeartHandshake}
          />
          <TaskCard
            href={withPeriod("/poc/messages", from, to, { task: "remind" })}
            title="Send a gentle reminder"
            description="Contact registered partners who have no gift recorded in the selected period."
            detail={`${answers.unpaidCount.toLocaleString("en-US")} people to review`}
            Icon={BellRing}
          />
          <TaskCard
            href={withPeriod("/poc/messages", from, to, { task: "update" })}
            title="Send a ministry update"
            description="Choose all partners, recent givers, repeat givers, top givers, or another prepared group."
            detail="Group filters, 20 drafts and attachments"
            Icon={Megaphone}
          />
          <TaskCard
            href={withPeriod("/poc/messages", from, to, { mode: "number" })}
            title="Message one person"
            description="Enter any valid international WhatsApp number for a personal message."
            Icon={UserRound}
          />
        </div>
      </section>
    </PocShell>
  );
}
