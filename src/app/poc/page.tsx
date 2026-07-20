import { BellRing, CircleDollarSign, PieChart, UserPlus } from "lucide-react";
import { loadReconciliation } from "@/lib/poc/db";
import { headlineAnswers, formatGhs } from "@/lib/poc/answers";
import { normalizePhone } from "@/lib/phone";
import { AskHero } from "./ask-hero";
import { PartnersTable, type PartnerRow, type TableData } from "./partners-table";
import { MessageCenter } from "./message-center";
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

type Row = PartnerRow & { amountMinor: number; latest: string };

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

  const registeredRows: Row[] = result.registeredPaid.map((rp) => {
    const latest = rp.payments.reduce((m, p) => (p.paidAt > m ? p.paidAt : m), "");
    return {
      name: rp.registration.fullName,
      phoneMasked: mask(rp.registration.phone),
      status: "registered" as const,
      amountMinor: rp.totalMinor,
      amountGhs: `GHS ${formatGhs(rp.totalMinor)}`,
      latest,
      when: formatWhen(latest),
    };
  });
  const unregisteredRows: Row[] = result.paidUnregistered.map((pu) => {
    const latest = pu.payments.reduce((m, p) => (p.paidAt > m ? p.paidAt : m), "");
    return {
      name: pu.suggestedName ?? "Unknown",
      phoneMasked: mask(pu.phone),
      status: "new" as const,
      amountMinor: pu.totalMinor,
      amountGhs: `GHS ${formatGhs(pu.totalMinor)}`,
      latest,
      when: formatWhen(latest),
    };
  });

  const all = [...registeredRows, ...unregisteredRows];
  const tableData: TableData = {
    gifts: [...all].sort((x, y) => y.amountMinor - x.amountMinor).slice(0, 8),
    unregistered: [...unregisteredRows].sort((x, y) => y.amountMinor - x.amountMinor).slice(0, 8),
    recent: [...all].sort((x, y) => (x.latest > y.latest ? -1 : 1)).slice(0, 8),
  };

  const gaveCount = a.registeredPaidCount + a.unregisteredCount;
  const denom = gaveCount + a.unpaidCount;
  const pct = denom > 0 ? Math.round((gaveCount / denom) * 100) : 0;
  // Average over person-attributed money only — statement rows have no giver to average.
  const attributedMinor = a.totalCollectedMinor - a.statementTotalMinor;
  const avgGiftGhs = a.paidCount > 0 ? formatGhs(Math.round(attributedMinor / a.paidCount / 100) * 100) : "0";
  const newGiverShare = gaveCount > 0 ? Math.round((a.unregisteredCount / gaveCount) * 100) : 0;
  const registerTotal = a.registeredPaidCount + a.unpaidCount;
  const ringC = 2 * Math.PI * 30;
  const configuredProvider = process.env.BENMP_MESSAGING_PROVIDER;
  const provider =
    configuredProvider === "twilio" || configuredProvider === "meta-cloud-api"
      ? configuredProvider
      : "mock";

  // The statement covers a window, not a calendar month — label it honestly.
  const paidDates = [...result.registeredPaid.flatMap((rp) => rp.payments), ...result.paidUnregistered.flatMap((pu) => pu.payments)]
    .map((p) => p.paidAt)
    .filter(Boolean)
    .sort();
  const periodLabel =
    paidDates.length > 0
      ? `${formatWhen(paidDates[0])} – ${formatWhen(paidDates[paidDates.length - 1])}`
      : "This period";

  return (
    <div className="min-h-screen bg-background pb-14 text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-5">
          <span className="flex items-center gap-2.5 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-success text-[13px] font-bold text-white">
              B
            </span>
            Global Crusade Partners
          </span>
          <span className="whitespace-nowrap rounded-full border border-border bg-background px-3 py-1 text-xs tabular-nums text-muted-foreground">
            {periodLabel}
          </span>
        </div>
      </header>
      <PocNav current="/poc" />

      <main className="mx-auto max-w-4xl px-5">
        <section className="pt-8">
          <h1 className="text-[22px] font-semibold tracking-tight">Ask about this period</h1>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Answers come from the reconciled giving — {denom} partners, {a.paidCount} payments.
          </p>
          <AskHero />
        </section>

        <SectionLabel>This period at a glance</SectionLabel>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted-foreground">Giving progress</p>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <PieChart className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="flex flex-1 items-center gap-4 py-3">
              <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] flex-none" role="img" aria-label={`${pct}% given`}>
                <circle cx="36" cy="36" r="30" fill="none" stroke="var(--border)" strokeWidth="7.5" />
                <circle
                  cx="36" cy="36" r="30" fill="none" stroke="var(--success)" strokeWidth="7.5"
                  strokeLinecap="round" strokeDasharray={`${(ringC * pct) / 100} ${ringC}`}
                  transform="rotate(-90 36 36)"
                />
                <text x="36" y="34" textAnchor="middle" className="fill-[var(--foreground)] text-[15px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {pct}%
                </text>
                <text x="36" y="46" textAnchor="middle" className="fill-[var(--muted-foreground)] text-[8px]">
                  given
                </text>
              </svg>
              <div className="space-y-2 text-xs leading-none">
                <p className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                  Gave&nbsp;<b className="text-foreground tabular-nums">{gaveCount}</b>
                </p>
                <p className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-border" aria-hidden />
                  Not yet&nbsp;<b className="text-foreground tabular-nums">{a.unpaidCount}</b>
                </p>
              </div>
            </div>
            <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
              <b className="font-semibold text-emerald-700 tabular-nums">{gaveCount}</b>{" "}of {denom.toLocaleString("en-US")} have given
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted-foreground">Collected</p>
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
              {a.paidCount} gifts · avg <b className="font-semibold text-emerald-700 tabular-nums">GHS {avgGiftGhs}</b>
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted-foreground">Gave, not registered</p>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                <UserPlus className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="flex flex-1 items-center py-3">
              <p className="text-[27px] font-semibold leading-none tracking-tight tabular-nums">{a.unregisteredCount}</p>
            </div>
            <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
              <b className="font-semibold text-violet-700 tabular-nums">{newGiverShare}%</b>{" "}of givers ·{" "}
              <b className="font-semibold tabular-nums">{a.statementRowCount}</b>{" "}bank rows filtered
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-muted-foreground">Reminder targets</p>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <BellRing className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="flex flex-1 items-center py-3">
              <p className="text-[27px] font-semibold leading-none tracking-tight tabular-nums">{a.unpaidCount}</p>
            </div>
            <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
              of <b className="font-semibold text-amber-700 tabular-nums">{registerTotal.toLocaleString("en-US")}</b>{" "}registered partners
            </p>
          </div>
        </section>

        <SectionLabel>Partners this period</SectionLabel>
        <PartnersTable data={tableData} />

        <SectionLabel>Message center</SectionLabel>
        <MessageCenter thankYous={gaveCount} reminders={a.unpaidCount} provider={provider} />

        <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground/80">
          <span>Staff workspace · confidential partner records</span>
          <span>BENMP · Healing Jesus Campaign</span>
        </footer>
      </main>
    </div>
  );
}
