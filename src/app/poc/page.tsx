import {
  BellRing,
  HeartHandshake,
  Megaphone,
  MessageCircleMore,
  PhoneCall,
} from "lucide-react";
import Link from "next/link";
import { headlineAnswers, formatGhs } from "@/lib/poc/answers";
import { loadReconciliationCached } from "@/lib/poc/cached-data";
import { getDashboardTiles } from "@/lib/poc/dashboard-metrics";
import { giverInsightGroups } from "@/lib/poc/giver-insights";
import {
  filterReconciliationByPeriod,
  reportingPeriod,
} from "@/lib/poc/reporting-period";
import { normalizePhone } from "@/lib/phone";
import { PocShell } from "./nav";
import { DashboardTilesSection } from "./breakdown-panel";
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


const ACTION_STYLES = [
  { bg: "bg-gradient-to-br from-[#e4fbf3] to-[#c9f4e4] border-[#b7ead8]", icon: "text-[#079779]" },
  { bg: "bg-gradient-to-br from-[#e7f4ff] to-[#d2eaff] border-[#c1ddf5]", icon: "text-[#177ed1]" },
  { bg: "bg-gradient-to-br from-[#f0eaff] to-[#dfd2ff] border-[#d7c7fa]", icon: "text-[#6941d9]" },
  { bg: "bg-gradient-to-br from-[#ffeaf2] to-[#ffd6e5] border-[#f4c6d7]", icon: "text-[#d93670]" },
];

function QuickAction({
  href,
  label,
  detail,
  Icon,
  index = 0,
}: {
  href: string;
  label: string;
  detail: string;
  Icon: typeof HeartHandshake;
  index?: number;
}) {
  const style = ACTION_STYLES[index % ACTION_STYLES.length]!;
  return (
    <Link
      href={href}
      className={`group relative grid min-h-[132px] grid-rows-[42px_auto] overflow-hidden rounded-[18px] border p-5 shadow-[0_2px_8px_rgba(16,42,67,0.07)] transition-all duration-180 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(16,42,67,0.09)] ${style.bg}`}
    >
      <span className={`grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-white/58 ${style.icon}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="mt-4 min-w-0">
        <b className="block text-[15px] font-bold text-[#06283d]">{label}</b>
        <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
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
  const tiles = await getDashboardTiles();
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
        <DashboardTilesSection tiles={tiles} />
      </section>

      <section className="mt-7" aria-labelledby="actions-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="actions-heading" className="text-base font-bold tracking-[-0.025em] text-[#06283d]">
              What would you like to do?
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The platform prepares the right records before anything is sent.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <QuickAction
            href={withPeriod("/poc/messages", from, to, { task: "thank" })}
            label="Thank givers"
            detail={`${activeGivers.toLocaleString("en-US")} people gave`}
            Icon={HeartHandshake}
            index={0}
          />
          <QuickAction
            href={withPeriod("/poc/messages", from, to, { task: "remind" })}
            label="Send reminders"
            detail={`${answers.unpaidCount.toLocaleString("en-US")} people to review`}
            Icon={BellRing}
            index={1}
          />
          <QuickAction
            href={withPeriod("/poc/messages", from, to, { task: "update" })}
            label="Ministry update"
            detail="Choose a group and add media"
            Icon={Megaphone}
            index={2}
          />
          <QuickAction
            href={withPeriod("/poc/calls", from, to)}
            label="Call partners"
            detail="Top and repeat givers"
            Icon={PhoneCall}
            index={3}
          />
        </div>
      </section>
      <section className="mt-7">
        <div className="rounded-[18px] border border-[#f2ddb0] bg-[radial-gradient(circle_at_100%_0%,rgba(255,208,87,0.20),transparent_30%),linear-gradient(135deg,#fff9e8,#fff1dc)] p-[18px] shadow-[0_2px_8px_rgba(16,42,67,0.07)]">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#ffb52d] text-white">
              <MessageCircleMore className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#06283d]">Needs attention</h2>
              <p className="text-[11px] text-muted-foreground">
                The most useful next steps from current records
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Link
              href={withPeriod("/poc/messages", from, to, { task: "thank" })}
              className="flex min-h-12 items-center justify-between gap-3 rounded-[12px] border border-[rgba(238,211,162,0.72)] bg-white/72 px-3 py-2.5 text-sm transition hover:-translate-y-px hover:bg-white hover:text-[#079779]"
            >
              <span>Review new giver acknowledgements</span>
              <b className="tabular-nums">{answers.unregisteredCount}</b>
            </Link>
            <Link
              href={withPeriod("/poc/messages", from, to, { task: "remind" })}
              className="flex min-h-12 items-center justify-between gap-3 rounded-[12px] border border-[rgba(238,211,162,0.72)] bg-white/72 px-3 py-2.5 text-sm transition hover:-translate-y-px hover:bg-white hover:text-[#079779]"
            >
              <span>Review partners with no gift</span>
              <b className="tabular-nums">{answers.unpaidCount}</b>
            </Link>
            <Link
              href={withPeriod("/poc/giving", from, to)}
              className="flex min-h-12 items-center justify-between gap-3 rounded-[12px] border border-[rgba(238,211,162,0.72)] bg-white/72 px-3 py-2.5 text-sm transition hover:-translate-y-px hover:bg-white hover:text-[#079779]"
            >
              <span>Check unattributed bank rows</span>
              <b className="tabular-nums">{answers.statementRowCount}</b>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="groups-heading">
        <div className="mb-3">
          <h2 id="groups-heading" className="text-base font-bold tracking-[-0.025em] text-[#06283d]">
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
