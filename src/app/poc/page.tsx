import { CheckCircle2, UserPlus, BellRing, CircleDollarSign } from "lucide-react";
import { MetricCard, Panel } from "@/components/dashboard/primitives";
import { loadReconciliation } from "@/lib/poc/db";
import { headlineAnswers, formatGhs } from "@/lib/poc/answers";
import { PocAsk } from "./ask-box";
import { PocSend } from "./send-panel";

export const dynamic = "force-dynamic";

export default async function PocPage() {
  const result = await loadReconciliation();
  const a = headlineAnswers(result);

  const topUnregistered = [...a.unregistered]
    .sort((x, y) => y.amountMinor - x.amountMinor)
    .slice(0, 10);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Qodesh · MoMo · this period
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Partner reconciliation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrations reconciled against the MoMo statement. Everyone who paid is included and
          thanked — even if they aren&apos;t on the register (Bishop Ebo&apos;s rule).
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Registered & paid"
          value={String(a.registeredPaidCount)}
          detail="On the sheet and gave"
          icon={CheckCircle2}
          tone="emerald"
        />
        <MetricCard
          label="Paid & unregistered"
          value={String(a.unregisteredCount)}
          detail="Not on the sheet — include & thank"
          icon={UserPlus}
          tone="violet"
        />
        <MetricCard
          label="Registered & unpaid"
          value={String(a.unpaidCount)}
          detail="Reminder targets"
          icon={BellRing}
          tone="amber"
        />
        <MetricCard
          label="Total collected"
          value={`GHS ${a.totalCollectedGhs}`}
          detail={`${a.paidCount} payers this period`}
          icon={CircleDollarSign}
          tone="slate"
        />
      </section>

      <Panel eyebrow="Messaging" title="Thank-yous & reminders">
        <PocSend />
      </Panel>

      <Panel eyebrow="Ask" title="Ask about this period">
        <PocAsk />
      </Panel>

      <Panel eyebrow="Bishop Ebo's rule" title={`Top unregistered givers (${a.unregisteredCount} total)`}>
        {topUnregistered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unregistered payers this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody>
                {topUnregistered.map((u) => (
                  <tr key={u.reference} className="border-t border-border">
                    <td className="py-2 pr-4 text-foreground">{u.name ?? "Unknown"}</td>
                    <td className="py-2 pr-4 text-foreground">GHS {formatGhs(u.amountMinor)}</td>
                    <td className="py-2 text-muted-foreground">
                      {u.phone ? `…${u.phone.slice(-4)}` : "no phone"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </main>
  );
}
