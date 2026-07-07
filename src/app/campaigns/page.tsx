import { Plus } from "lucide-react";
import {
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { ActionButton, PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getCampaignsView } from "@/lib/data";
import { minorCurrency } from "@/lib/utils";

export default async function CampaignsPage() {
  const { navItems, metrics, campaigns, reportQueue } =
    await getCampaignsView();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Crusades and reports"
        title="Campaigns"
        description="Track upcoming crusades, partner support, funding progress, campaign reports, testimonies, and segment-specific updates."
      >
        <ActionButton icon={Plus} primary>
          New Campaign
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <Panel title="Campaign List" eyebrow="Support and reporting">
        <ResponsiveRecordTable
          rows={campaigns}
          getRowKey={(campaign) => campaign.id}
          getTitle={(campaign) => campaign.name}
          getSubtitle={(campaign) => `${campaign.city}, ${campaign.country}`}
          getStatus={(campaign) => campaign.status}
          minWidth="980px"
          columns={[
            {
              header: "Campaign",
              primary: true,
              render: (campaign) => campaign.name,
            },
            {
              header: "Location",
              render: (campaign) => `${campaign.city}, ${campaign.country}`,
            },
            { header: "Dates", render: (campaign) => campaign.dates },
            {
              header: "Partners",
              render: (campaign) => campaign.partnerCount.toLocaleString(),
            },
            {
              header: "Funding",
              render: (campaign) =>
                `${minorCurrency(
                  campaign.raised.amountMinor,
                  campaign.raised.currency,
                )} / ${minorCurrency(
                  campaign.fundingGoal.amountMinor,
                  campaign.fundingGoal.currency,
                )}`,
            },
            {
              header: "Report",
              render: (campaign) => (
                <StatusBadge label={campaign.reportStatus} />
              ),
            },
            {
              header: "Next Update",
              render: (campaign) => campaign.nextUpdate,
            },
            {
              header: "Status",
              render: (campaign) => <StatusBadge label={campaign.status} />,
            },
          ]}
        />
      </Panel>

      <Panel title="Partner Update Queue" eyebrow="Reports and appeals">
        <ResponsiveRecordTable
          rows={reportQueue}
          getRowKey={(batch) => batch.id}
          getTitle={(batch) => batch.name}
          getSubtitle={(batch) => `${batch.segmentName} - ${batch.channel}`}
          getStatus={(batch) => batch.status}
          minWidth="860px"
          columns={[
            { header: "Update", primary: true, render: (batch) => batch.name },
            { header: "Audience", render: (batch) => batch.segmentName },
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
            {
              header: "Status",
              render: (batch) => <StatusBadge label={batch.status} />,
            },
          ]}
        />
      </Panel>
    </DashboardShell>
  );
}
