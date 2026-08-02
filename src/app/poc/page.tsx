import { BellRing, CircleDollarSign, UserPlus, Users } from "lucide-react";
import { loadReconciliation } from "@/lib/poc/db";
import { headlineAnswers, formatGhs } from "@/lib/poc/answers";
import { giverInsightGroups } from "@/lib/poc/giver-insights";
import { reportingPeriod } from "@/lib/poc/reporting-period";
import { normalizePhone } from "@/lib/phone";
import { AskHero } from "./ask-hero";
import {
  PartnersTable,
  type PartnerRow,
  type TableData,
} from "./partners-table";
import { PocNav } from "./nav";

export const dynamic = "force-dynamic";

function mask(phone: string | null): string {
  const e164 = normalizePhone(phone);
  return e164 ? `…${e164.slice(-4)}` : "no phone";
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * "2026-07-05T19:48:01+00:00" -> "5 Jul" (Ghana is UTC year-round).
 *
 * Date only, deliberately: 39% of the statement's person payments carry a batch
 * timestamp of exactly 03:00 (scheduled transfers settling overnight), so the
 * time-of-day is a posting artifact rather than when the partner actually gave.
 * The full timestamp stays in payments.paid_at for finance queries.
 */
function formatWhen(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
}

export default async function PocPage() {
  const result = await loadReconciliation();
  const a = headlineAnswers(result);

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

  const gaveCount = a.registeredPaidCount + a.unregisteredCount;
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
  const avgGiftGhs =
    giftCount > 0
      ? formatGhs(Math.round(a.totalCollectedMinor / giftCount))
      : "0";
  const newGiverShare =
    gaveCount > 0 ? Math.round((a.unregisteredCount / gaveCount) * 100) : 0;
  const registerTotal = a.registeredPaidCount + a.unpaidCount;
  const period = reportingPeriod(result);

  return (
    <div className="min-h-screen bg-background pb-14 text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-14 max-w-4xl items-center justify-between gap-3 px-4 py-2 sm:px-5">
          <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-success text-[13px] font-bold text-white">
              B
            </span>
            <span className="truncate">Global Crusade Partners</span>
          </span>
          <span className="max-w-[46%] whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground sm:max-w-none sm:px-3 sm:text-xs">
            Giving: {period.compactLabel}
          </span>
        </div>
      </header>
      <PocNav current="/poc" />

      <main className="mx-auto max-w-4xl px-4 sm:px-5">
        <section className="pt-8">
          <h1 className="text-[22px] font-semibold tracking-tight">
            Ask about giving
          </h1>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Answers use gifts recorded from {period.label} —{" "}
            {a.totalPeople.toLocaleString("en-US")} tracked people,{" "}
            {gaveCount.toLocaleString("en-US")} active givers.
          </p>
          <AskHero />
        </section>

        <SectionLabel>Giving overview</SectionLabel>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted-foreground">
                Active BENMP partners
              </p>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <Users className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="flex flex-1 items-center py-3">
              <p className="text-[27px] font-semibold leading-none tracking-tight tabular-nums">
                {gaveCount.toLocaleString("en-US")}
              </p>
            </div>
            <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
              Identifiable people who gave in the loaded giving window
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted-foreground">
                Collected
              </p>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <CircleDollarSign className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="flex flex-1 items-center py-3">
              <p className="text-[27px] font-semibold leading-none tracking-tight tabular-nums">
                GHS {a.totalCollectedGhs}
              </p>
            </div>
            <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
              {giftCount.toLocaleString("en-US")} gifts · avg{" "}
              <b className="font-semibold text-emerald-700 tabular-nums">
                GHS {avgGiftGhs}
              </b>
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted-foreground">
                Gave, not registered
              </p>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                <UserPlus className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="flex flex-1 items-center py-3">
              <p className="text-[27px] font-semibold leading-none tracking-tight tabular-nums">
                {a.unregisteredCount}
              </p>
            </div>
            <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
              <b className="font-semibold text-violet-700 tabular-nums">
                {newGiverShare}%
              </b>{" "}
              of givers ·{" "}
              <b className="font-semibold tabular-nums">
                {a.statementRowCount}
              </b>{" "}
              bank rows filtered
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted-foreground">
                Reminder targets
              </p>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <BellRing className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="flex flex-1 items-center py-3">
              <p className="text-[27px] font-semibold leading-none tracking-tight tabular-nums">
                {a.unpaidCount}
              </p>
            </div>
            <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
              of{" "}
              <b className="font-semibold text-amber-700 tabular-nums">
                {registerTotal.toLocaleString("en-US")}
              </b>{" "}
              registered partners
            </p>
          </div>
        </section>

        <SectionLabel>Giver groups</SectionLabel>
        <PartnersTable data={tableData} />

        <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground/80">
          <span>Staff workspace · confidential partner records</span>
          <span>BENMP · Healing Jesus Campaign</span>
        </footer>
      </main>
    </div>
  );
}
