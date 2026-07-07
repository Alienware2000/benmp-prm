import { Plus } from "lucide-react";
import {
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { ActionButton, PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getCommunicationView } from "@/lib/data";

export default async function CommunicationPage() {
  const { navItems, metrics, segments, batches, providers, approvalChecklist } =
    await getCommunicationView();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Communication"
        title="Messaging Center"
        description="Build auditable partner segments, approve message batches, and route WhatsApp, SMS, and email through provider adapters without locking the ministry into one vendor."
      >
        <ActionButton icon={Plus} href="/?mode=message#workspace" primary>
          New Message
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Approval Queue" eyebrow="Outbound batches">
          <ResponsiveRecordTable
            rows={batches}
            getRowKey={(batch) => batch.id}
            getTitle={(batch) => batch.name}
            getSubtitle={(batch) => `${batch.segmentName} - ${batch.channel}`}
            getStatus={(batch) => batch.status}
            minWidth="900px"
            columns={[
              { header: "Batch", primary: true, render: (batch) => batch.name },
              { header: "Segment", render: (batch) => batch.segmentName },
              { header: "Channel", render: (batch) => batch.channel },
              {
                header: "Recipients",
                render: (batch) => batch.recipientCount.toLocaleString(),
              },
              {
                header: "Template",
                render: (batch) => <StatusBadge label={batch.templateStatus} />,
              },
              { header: "Owner", render: (batch) => batch.approvalOwner },
              { header: "Schedule", render: (batch) => batch.scheduledFor },
              {
                header: "Status",
                render: (batch) => <StatusBadge label={batch.status} />,
              },
            ]}
          />
        </Panel>

        <Panel title="Approval Controls" eyebrow="Before real sending">
          <div className="space-y-3">
            {approvalChecklist.map((item) => (
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

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Segments" eyebrow="Targetable audiences">
          <ResponsiveRecordTable
            rows={segments}
            getRowKey={(segment) => segment.id}
            getTitle={(segment) => segment.name}
            getSubtitle={(segment) => segment.description}
            getStatus={(segment) => segment.complianceStatus}
            columns={[
              {
                header: "Segment",
                primary: true,
                render: (segment) => segment.name,
              },
              { header: "Channel", render: (segment) => segment.channel },
              {
                header: "Recipients",
                render: (segment) => segment.recipientCount.toLocaleString(),
              },
              {
                header: "Criteria",
                render: (segment) => segment.criteria.join(", "),
              },
              { header: "Owner", render: (segment) => segment.owner },
              {
                header: "Compliance",
                render: (segment) => (
                  <StatusBadge label={segment.complianceStatus} />
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="Provider Adapters" eyebrow="No lock-in">
          <div className="space-y-3">
            {providers.map((provider) => (
              <div
                key={provider.providerKey}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {provider.name}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {provider.providerKey}
                    </p>
                  </div>
                  <StatusBadge label={provider.status} />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {provider.detail}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </DashboardShell>
  );
}
