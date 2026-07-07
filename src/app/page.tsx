import { Suspense } from "react";
import {
  Insight,
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { TodayWorkspace } from "@/components/workspace/today-workspace";
import { getCommunicationView, getDashboardOverview } from "@/lib/data";
import { compactNumber, minorCurrency } from "@/lib/utils";

export default async function Home() {
  const communicationView = await getCommunicationView();
  const {
    navItems,
    metrics,
    givingTrend,
    priorities,
    countrySummaries,
    dataReadiness,
    campaigns,
    partnerRows,
  } = await getDashboardOverview();
  const maxGiving = Math.max(
    ...givingTrend.map((item) => item.amount.amountMinor),
  );

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Global Crusade Partners Platform"
        title="Today"
        description="Internal workspace for partner intake, follow-up ownership, messaging, giving review, and campaign readiness."
      />

      <Suspense
        fallback={
          <section
            id="workspace"
            className="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm"
          >
            Loading workspace...
          </section>
        }
      >
        <TodayWorkspace
          initialPartners={partnerRows}
          initialTasks={priorities}
          initialMessages={communicationView.batches}
          segments={communicationView.segments}
        />
      </Suspense>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <Panel title="Country Portfolio" eyebrow="Regional view">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
