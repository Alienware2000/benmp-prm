import { FileUp } from "lucide-react";
import {
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { ActionButton, PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getGivingView } from "@/lib/data";
import { minorCurrency } from "@/lib/utils";

export default async function GivingPage() {
  const { navItems, metrics, contributions, imports, followUpTriggers } =
    await getGivingView();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Giving records"
        title="Giving"
        description="Track contribution history, import batches, recurring commitments, campaign support, failed payments, and finance review without storing payment card data."
      >
        <ActionButton icon={FileUp} primary>
          Import Payments
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Payment Imports" eyebrow="Finance review queue">
          <ResponsiveRecordTable
            rows={imports}
            getRowKey={(batch) => batch.id}
            getTitle={(batch) => batch.fileName}
            getSubtitle={(batch) => `${batch.provider} - ${batch.importedAt}`}
            getStatus={(batch) => batch.status}
            columns={[
              {
                header: "File",
                primary: true,
                render: (batch) => batch.fileName,
              },
              { header: "Provider", render: (batch) => batch.provider },
              { header: "Rows", render: (batch) => batch.rowCount },
              { header: "Matched", render: (batch) => batch.matchedCount },
              { header: "Ambiguous", render: (batch) => batch.ambiguousCount },
              { header: "Owner", render: (batch) => batch.owner },
              {
                header: "Status",
                render: (batch) => <StatusBadge label={batch.status} />,
              },
            ]}
          />
        </Panel>

        <Panel title="Follow-up Triggers" eyebrow="Giving health">
          <div className="space-y-3">
            {followUpTriggers.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {item.label}
                  </p>
                  <StatusBadge label={item.status} />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Contribution Ledger" eyebrow="Auditable history">
        <ResponsiveRecordTable
          rows={contributions}
          getRowKey={(contribution) => contribution.id}
          getTitle={(contribution) => contribution.partnerName}
          getSubtitle={(contribution) =>
            `${contribution.contributionDate} - ${contribution.paymentMethod}`
          }
          getStatus={(contribution) => contribution.status}
          minWidth="960px"
          columns={[
            {
              header: "Date",
              render: (contribution) => contribution.contributionDate,
            },
            {
              header: "Partner",
              primary: true,
              render: (contribution) => contribution.partnerName,
            },
            {
              header: "Amount",
              render: (contribution) =>
                minorCurrency(
                  contribution.amount.amountMinor,
                  contribution.amount.currency,
                ),
            },
            {
              header: "Method",
              render: (contribution) => contribution.paymentMethod,
            },
            {
              header: "Campaign",
              render: (contribution) => contribution.campaignName,
            },
            {
              header: "Provider Ref",
              render: (contribution) => contribution.providerReference,
            },
            {
              header: "Match",
              render: (contribution) => (
                <StatusBadge label={contribution.reconciliationStatus} />
              ),
            },
            {
              header: "Status",
              render: (contribution) => (
                <StatusBadge label={contribution.status} />
              ),
            },
          ]}
        />
      </Panel>
    </DashboardShell>
  );
}
