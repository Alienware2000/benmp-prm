import {
  BellRing,
  CircleDollarSign,
  HeartHandshake,
  Megaphone,
  MessageCircleMore,
  PhoneCall,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { headlineAnswers, formatGhs } from "@/lib/poc/answers";
import { loadReconciliationCached } from "@/lib/poc/cached-data";
import { giverInsightGroups } from "@/lib/poc/giver-insights";
import {
  filterReconciliationByPeriod,
  reportingPeriod,
} from "@/lib/poc/reporting-period";
import { normalizePhone } from "@/lib/phone";
import { PocShell } from "./nav";
import {
  PartnersTable,
  type PartnerRow,
  type TableData,
} from "./partners-table";
import { PeriodFilter } from "./period-filter";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ from?: string; to?: string }>;

function mask(phone: string | null): string {
  const e164 = normalizePhone(phone);
  return e164 ? `…${e164.slice(-4)}` : "no phone";
}

function formatWhen(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getUTCDate()} ${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
}

function withPeriod(
  href: string,
  from: string,
  to: string,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams(extra);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `${href}?${query}` : href;
}

function MetricCard({
  label,
  value,
  detail,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  Icon: typeof Users;
  tone: "teal" | "green" | "yellow" | "coral";
}) {
  const tones = {
    teal: "bg-cyan-50 text-brand ring-cyan-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    yellow: "bg-amber-50 text-amber-700 ring-amber-100",
    coral: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  return (
    <article className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <span
          className={`grid h-9 w-9 flex-none place-items-center rounded-md ring-1 ${tones[tone]}`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-4 truncate text-2xl font-bold tabular-nums text-foreground sm:text-[26px]">
        {value}
      </p>
      <p className="mt-2 border-t border-border pt-2 text-[11px] leading-5 text-muted-foreground">
        {detail}
      </p>
    </article>
  );
}

function QuickAction({
  href,
  label,
  detail,
  Icon,
}: {
  href: string;
  label: string;
  detail: string;
  Icon: typeof HeartHandshake;
}) {
  return (
    <Link
      href={href}
      className="group grid min-h-[116px] grid-rows-[42px_auto] rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
    >
      <span className="grid h-10 w-10 place-items-center rounded-md bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="mt-3 min-w-0">
        <b className="block text-sm text-foreground">{label}</b>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {detail}
        </span>
      </span>
    </Link>
  );
}

export default async function PocPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const from = (sp.from ?? "").slice(0, 10);
  const to = (sp.to ?? "").slice(0, 10);
  const completeResult = await loadReconciliationCached();
  const availablePeriod = reportingPeriod(completeResult);
  const result = filterReconciliationByPeriod(completeResult, { from, to });
  const period = reportingPeriod(result);
  const answers = headlineAnswers(result);
  const insightGroups = giverInsightGroups(result, { limit: 20 });

  const toPartnerRow = (
    giver: (typeof insightGroups)["top"][number],
  ): PartnerRow => ({
    name: giver.name,
    phoneMasked: mask(giver.phone),
    status: giver.registered ? "registered" : "new",
    amountGhs: `GHS ${formatGhs(giver.amountMinor)}`,
    when: formatWhen(giver.latest),
    giftCount: giver.giftCount,
  });
  const tableData: TableData = {
    top: insightGroups.top.map(toPartnerRow),
    consistent: insightGroups.consistent.map(toPartnerRow),
    ordinary: insightGroups.ordinary.map(toPartnerRow),
  };

  const activeGivers = answers.registeredPaidCount + answers.unregisteredCount;
  const giftCount =
    result.registeredPaid.reduce(
      (count, giver) => count + giver.payments.length,
      0,
    ) +
    result.paidUnregistered.reduce(
      (count, giver) => count + giver.payments.length,
      0,
    ) +
    result.statementRows.length;
  const average = giftCount
    ? formatGhs(Math.round(answers.totalCollectedMinor / giftCount))
    : "0";

  const toolbar = (
    <PeriodFilter
      availableStart={availablePeriod.start}
      availableEnd={availablePeriod.end}
      currentFrom={from}
      currentTo={to}
    />
  );

  return (
    <PocShell
      title="Dashboard"
      subtitle={`Giving activity for ${period.label}. Start with what needs attention, then open the detailed record when needed.`}
      toolbar={toolbar}
    >
      <section aria-labelledby="overview-heading">
        <h2
          id="overview-heading"
          className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Giving overview
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Active BENMP partners"
            value={activeGivers.toLocaleString("en-US")}
            detail="Identifiable people with a recorded gift"
            Icon={Users}
            tone="teal"
          />
          <MetricCard
            label="Giving received"
            value={`GHS ${answers.totalCollectedGhs}`}
            detail={`${giftCount.toLocaleString("en-US")} gifts · average GHS ${average}`}
            Icon={CircleDollarSign}
            tone="green"
          />
          <MetricCard
            label="New givers"
            value={answers.unregisteredCount.toLocaleString("en-US")}
            detail="Gave but are not yet linked to a partner profile"
            Icon={UserPlus}
            tone="yellow"
          />
          <MetricCard
            label="Need follow-up"
            value={answers.unpaidCount.toLocaleString("en-US")}
            detail="Registered partners with no gift in this period"
            Icon={BellRing}
            tone="coral"
          />
        </div>
      </section>

      <section className="mt-7" aria-labelledby="actions-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="actions-heading" className="text-base font-bold">
              What would you like to do?
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The platform prepares the right records before anything is sent.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction
            href={withPeriod("/poc/messages", from, to, { task: "thank" })}
            label="Thank givers"
            detail={`${activeGivers.toLocaleString("en-US")} people gave`}
            Icon={HeartHandshake}
          />
          <QuickAction
            href={withPeriod("/poc/messages", from, to, { task: "remind" })}
            label="Send reminders"
            detail={`${answers.unpaidCount.toLocaleString("en-US")} people to review`}
            Icon={BellRing}
          />
          <QuickAction
            href={withPeriod("/poc/messages", from, to, { task: "update" })}
            label="Ministry update"
            detail="Choose a group and add media"
            Icon={Megaphone}
          />
          <QuickAction
            href={withPeriod("/poc/calls", from, to)}
            label="Call partners"
            detail="Top and repeat givers"
            Icon={PhoneCall}
          />
        </div>
      </section>

      <section className="mt-7">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent/25 text-accent-foreground">
              <MessageCircleMore className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold">Needs attention</h2>
              <p className="text-[11px] text-muted-foreground">
                The most useful next steps from current records
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Link
              href={withPeriod("/poc/messages", from, to, { task: "thank" })}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md bg-background px-3 py-2.5 text-sm hover:text-brand"
            >
              <span>Review new giver acknowledgements</span>
              <b className="tabular-nums">{answers.unregisteredCount}</b>
            </Link>
            <Link
              href={withPeriod("/poc/messages", from, to, { task: "remind" })}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md bg-background px-3 py-2.5 text-sm hover:text-brand"
            >
              <span>Review partners with no gift</span>
              <b className="tabular-nums">{answers.unpaidCount}</b>
            </Link>
            <Link
              href={withPeriod("/poc/giving", from, to)}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md bg-background px-3 py-2.5 text-sm hover:text-brand"
            >
              <span>Check unattributed bank rows</span>
              <b className="tabular-nums">{answers.statementRowCount}</b>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="groups-heading">
        <div className="mb-3">
          <h2 id="groups-heading" className="text-base font-bold">
            Giver groups
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Top, repeat and ordinary givers are separated so each person appears
            once.
          </p>
        </div>
        <PartnersTable data={tableData} />
      </section>
    </PocShell>
  );
}
