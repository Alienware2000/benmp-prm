import { loadReconciliation } from "@/lib/poc/db";
import { headlineAnswers, formatGhs } from "@/lib/poc/answers";
import { normalizePhone } from "@/lib/phone";
import { AskHero } from "./ask-hero";
import { PartnersTable, type PartnerRow, type TableData } from "./partners-table";
import { MessageCenter } from "./message-center";

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

export default async function PocPage() {
  const result = await loadReconciliation();
  const a = headlineAnswers(result);

  const registeredRows: Row[] = result.registeredPaid.map((rp) => ({
    name: rp.registration.fullName,
    phoneMasked: mask(rp.registration.phone),
    status: "registered" as const,
    amountMinor: rp.totalMinor,
    amountGhs: `GHS ${formatGhs(rp.totalMinor)}`,
    latest: rp.payments.reduce((m, p) => (p.paidAt > m ? p.paidAt : m), ""),
  }));
  const unregisteredRows: Row[] = result.paidUnregistered.map((pu) => ({
    name: pu.suggestedName ?? "Unknown",
    phoneMasked: mask(pu.payment.payerPhone),
    status: "new" as const,
    amountMinor: pu.payment.amountMinor,
    amountGhs: `GHS ${formatGhs(pu.payment.amountMinor)}`,
    latest: pu.payment.paidAt,
  }));

  const all = [...registeredRows, ...unregisteredRows];
  const tableData: TableData = {
    gifts: [...all].sort((x, y) => y.amountMinor - x.amountMinor).slice(0, 8),
    unregistered: [...unregisteredRows].sort((x, y) => y.amountMinor - x.amountMinor).slice(0, 8),
    recent: [...all].sort((x, y) => (x.latest > y.latest ? -1 : 1)).slice(0, 8),
  };

  const gaveCount = a.registeredPaidCount + a.unregisteredCount;
  const denom = gaveCount + a.unpaidCount;
  const pct = denom > 0 ? Math.round((gaveCount / denom) * 100) : 0;
  const provider = process.env.BENMP_MESSAGING_PROVIDER === "twilio" ? "twilio" : "mock";

  return (
    <div className="min-h-screen bg-background pb-14 text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-5">
          <span className="flex items-center gap-2.5 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-success text-[13px] font-bold text-white">
              B
            </span>
            Global Crusade Partners
            <span className="font-normal text-muted-foreground/80">· Qodesh</span>
          </span>
          <span className="whitespace-nowrap rounded-full border border-border bg-background px-3 py-1 text-xs tabular-nums text-muted-foreground">
            This period
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5">
        <section className="pt-8">
          <h1 className="text-[22px] font-semibold tracking-tight">Ask about this month</h1>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Answers come from the reconciled giving — {denom} partners, {a.paidCount} payments.
          </p>
          <AskHero />
        </section>

        <SectionLabel>This month at a glance</SectionLabel>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="mb-2.5 text-xs font-semibold text-muted-foreground">Given vs outstanding</h3>
            <div className="flex items-center gap-4">
              <span className="relative grid h-[84px] w-[84px] flex-none place-items-center">
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(var(--success) 0 ${pct}%, var(--border) ${pct}% 100%)`,
                  }}
                  aria-hidden
                />
                <span className="absolute inset-[13px] grid place-items-center rounded-full bg-surface text-center">
                  <span>
                    <span className="block text-[17px] font-bold leading-none tabular-nums">{pct}%</span>
                    <span className="text-[9.5px] text-muted-foreground">given</span>
                  </span>
                </span>
              </span>
              <div className="space-y-1.5 text-xs">
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm bg-success" aria-hidden /> Gave —{" "}
                  <b className="tabular-nums">{gaveCount}</b>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm bg-border" aria-hidden /> Not yet —{" "}
                  <b className="tabular-nums">{a.unpaidCount}</b>
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="text-xs font-semibold text-muted-foreground">Collected</h3>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">GHS {a.totalCollectedGhs}</p>
            <p className="mt-1 text-xs text-muted-foreground">across {a.paidCount} payers</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="text-xs font-semibold text-muted-foreground">Gave, not registered</h3>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{a.unregisteredCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">included &amp; thanked anyway</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="text-xs font-semibold text-muted-foreground">Reminder targets</h3>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{a.unpaidCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">registered, not yet given</p>
          </div>
        </section>

        <SectionLabel>Partners this month</SectionLabel>
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
