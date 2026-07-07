import { CircleDollarSign, FileUp } from "lucide-react";
import { GivingReconciliation } from "@/components/demo/giving-reconciliation";
import {
  DataTable,
  MetricCard,
  Panel,
  StatusBadge,
  TableCell,
  TableHeader,
} from "@/components/dashboard/primitives";
import { ActionButton, PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getDashboardOverview } from "@/lib/data";

const givingStats = [
  {
    label: "July Giving",
    value: "$186k",
    detail: "USD equivalent",
    tone: "amber",
    icon: CircleDollarSign,
  },
  {
    label: "Recurring Active",
    value: "7,316",
    detail: "Monthly commitments",
    tone: "emerald",
    icon: CircleDollarSign,
  },
  {
    label: "Failed Payments",
    value: "37",
    detail: "Needs finance review",
    tone: "rose",
    icon: CircleDollarSign,
  },
  {
    label: "Unmatched Rows",
    value: "14",
    detail: "Import reconciliation",
    tone: "violet",
    icon: CircleDollarSign,
  },
];

const contributions = [
  [
    "Jul 2, 2026",
    "Ama Serwaa",
    "$120",
    "USD",
    "Paystack card",
    "Banjul",
    "Approved",
  ],
  [
    "Jul 1, 2026",
    "Daniel Okafor",
    "$5,000",
    "USD",
    "Bank transfer",
    "Banjul",
    "Approved",
  ],
  [
    "Jun 28, 2026",
    "Angela Boateng",
    "GBP 250",
    "GBP",
    "PayPal",
    "General",
    "Approved",
  ],
  [
    "Jun 20, 2026",
    "Marie N'Guessan",
    "XOF 40,000",
    "XOF",
    "Mobile money",
    "Assomada",
    "Review",
  ],
];

const health = [
  [
    "Monthly partner due soon",
    "3,240",
    "Prepare appreciation and reminder messages",
  ],
  ["Missed one month", "311", "Gentle WhatsApp follow-up"],
  ["Missed two months", "117", "Coordinator call queue"],
  ["Major partner report due", "21", "Send campaign-specific update"],
];

export default async function GivingPage() {
  const { navItems } = await getDashboardOverview();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Giving records"
        title="Giving"
        description="Track contributions, recurring commitments, campaign support, failed payments, and import reconciliation without storing payment card data."
      >
        <ActionButton icon={FileUp} primary>
          Import Payments
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {givingStats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <GivingReconciliation />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel
          title="Recent Contributions"
          eyebrow="Financial history"
          action="Export"
        >
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Date</TableHeader>
                <TableHeader>Partner</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Currency</TableHeader>
                <TableHeader>Method</TableHeader>
                <TableHeader>Campaign</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {contributions.map(
                ([
                  date,
                  partner,
                  amount,
                  currency,
                  method,
                  campaign,
                  status,
                ]) => (
                  <tr key={`${date}-${partner}`} className="hover:bg-muted/40">
                    <TableCell>{date}</TableCell>
                    <TableCell strong>{partner}</TableCell>
                    <TableCell>{amount}</TableCell>
                    <TableCell>{currency}</TableCell>
                    <TableCell>{method}</TableCell>
                    <TableCell>{campaign}</TableCell>
                    <TableCell>
                      <StatusBadge label={status} />
                    </TableCell>
                  </tr>
                ),
              )}
            </tbody>
          </DataTable>
        </Panel>

        <Panel
          title="Giving Health"
          eyebrow="Follow-up triggers"
          action="Create tasks"
        >
          <div className="space-y-3">
            {health.map(([label, count, action]) => (
              <div key={label} className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {count}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {action}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </DashboardShell>
  );
}
