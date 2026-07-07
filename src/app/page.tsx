import {
  Insight,
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import {
  DefaultHeaderActions,
  PageHeader,
} from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getDashboardOverview } from "@/lib/data";
import { compactNumber, minorCurrency } from "@/lib/utils";

export default async function Home() {
  const {
    navItems,
    metrics,
    givingTrend,
    priorities,
    countrySummaries,
    dataReadiness,
    campaigns,
  } = await getDashboardOverview();
  const maxGiving = Math.max(
    ...givingTrend.map((item) => item.amount.amountMinor),
  );

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="BENMP internal"
        title="Global Crusade Partners Platform"
        description="A staff workspace for partner records, giving operations, communication approvals, prayer care, campaign reporting, and follow-up ownership."
      >
        <DefaultHeaderActions />
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            icon={metric.icon}
            tone={metric.tone}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <Panel title="Today's Operating Queue" eyebrow="Owned staff work">
          <div className="divide-y divide-border">
            {priorities.map((task) => (
              <article
                key={task.id}
                className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_160px]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {task.partnerName}
                    </h3>
                    <StatusBadge label={task.status} />
                    <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                      {task.priority}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {task.reason}: {task.nextAction}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground lg:grid-cols-1">
                  <span>{task.owner}</span>
                  <span>{task.dueOn}</span>
                  <span>{task.channel}</span>
                  <span>{task.country}</span>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Backend Readiness" eyebrow="Plug-in path">
          <div className="space-y-3">
            {dataReadiness.map((item) => (
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
        <Panel title="Giving Momentum" eyebrow="Last 6 months">
          <div className="flex h-[244px] items-end gap-3 rounded-lg border border-border bg-muted/40 p-4">
            {givingTrend.map((item) => (
              <div
                key={item.month}
                className="flex h-full flex-1 flex-col justify-end gap-2"
              >
                <div className="flex flex-1 items-end">
                  <div
                    className="w-full rounded-md bg-primary"
                    style={{
                      height: `${Math.max((item.amount.amountMinor / maxGiving) * 100, 12)}%`,
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {item.month}
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-foreground">
                    {compactNumber(item.amount.amountMinor / 100)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Country Portfolio" eyebrow="Regional view">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {countrySummaries.map((country) => (
              <Insight
                key={country.country}
                label={`${country.country} - ${country.primaryChannel}`}
                value={country.partners.toLocaleString()}
                detail={`${country.monthlyPartners.toLocaleString()} monthly - ${minorCurrency(
                  country.giving.amountMinor,
                  country.giving.currency,
                )} giving - ${country.openFollowUps} follow-ups`}
              />
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Campaign Readiness" eyebrow="Crusades and reports">
        <ResponsiveRecordTable
          rows={campaigns}
          getRowKey={(campaign) => campaign.id}
          getTitle={(campaign) => campaign.name}
          getSubtitle={(campaign) => `${campaign.city}, ${campaign.country}`}
          getStatus={(campaign) => campaign.status}
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
              header: "Raised",
              render: (campaign) =>
                `${minorCurrency(
                  campaign.raised.amountMinor,
                  campaign.raised.currency,
                )} of ${minorCurrency(
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
              header: "Status",
              render: (campaign) => <StatusBadge label={campaign.status} />,
            },
          ]}
        />
      </Panel>
    </DashboardShell>
  );
}
