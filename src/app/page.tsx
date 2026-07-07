import { ChevronRight, Sparkles } from "lucide-react";
import {
  DataTable,
  Insight,
  MetricCard,
  Panel,
  StatusBadge,
  TableCell,
  TableHeader,
} from "@/components/dashboard/primitives";
import {
  DefaultHeaderActions,
  PageHeader,
} from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getDashboardOverview } from "@/lib/data";
import { compactNumber } from "@/lib/utils";

export default async function Home() {
  const { navItems, metrics, givingTrend, followUps, campaigns, partnerRows } =
    await getDashboardOverview();
  const maxGiving = Math.max(...givingTrend.map((item) => item.amount));

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="BENMP internal"
        title="Global Crusade Partners Platform"
        description="Partner relationships, giving, follow-up, prayer requests, and campaign communication in one staff workspace."
      >
        <DefaultHeaderActions />
      </PageHeader>

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

      <section className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-amber-200">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">AI-native direction</p>
            <p className="mt-1 leading-6 text-amber-900/80">
              Start with trustworthy partner and giving data. Then add a
              supervised assistant for partner briefings, message drafts,
              payment reconciliation, and follow-up suggestions.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <Panel
          title="Giving Momentum"
          eyebrow="Last 6 months"
          action="View giving"
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
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
                        height: `${Math.max((item.amount / maxGiving) * 100, 12)}%`,
                      }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {item.month}
                    </p>
                    <p className="text-xs font-semibold tabular-nums text-foreground">
                      {compactNumber(item.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid content-between gap-3">
              <Insight
                label="Monthly partners current"
                value="7,316"
                detail="Flag missed partners before the month closes."
              />
              <Insight
                label="Due for appreciation"
                value="3,240"
                detail="Ghana WhatsApp segment is ready for review."
              />
              <Insight
                label="Needs finance review"
                value="37"
                detail="Unmatched donations from imported payment exports."
              />
            </div>
          </div>
        </Panel>

        <Panel title="Follow-up Queue" eyebrow="Today" action="Open tasks">
          <div className="divide-y divide-border">
            {followUps.map((item) => (
              <div
                key={item.partner}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar text-white">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {item.partner}
                    </p>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.reason}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
                    <span>{item.country}</span>
                    <span>{item.channel}</span>
                    <span>{item.owner}</span>
                  </div>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Campaigns" eyebrow="Upcoming and live" action="Manage">
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.name}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {campaign.name}
                      </h3>
                      <StatusBadge label={campaign.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {campaign.place}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {campaign.dates}
                    </p>
                  </div>
                  <p className="text-right text-xs font-semibold text-foreground">
                    {campaign.partners.toLocaleString()}
                    <span className="block font-medium text-muted-foreground">
                      partners
                    </span>
                  </p>
                </div>
                <div className="mt-4 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${campaign.progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  {campaign.progress}% of current partner support target
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Partner Snapshot"
          eyebrow="Relationship health"
          action="View all"
        >
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Partner</TableHeader>
                <TableHeader>Country</TableHeader>
                <TableHeader>Level</TableHeader>
                <TableHeader>Lifetime</TableHeader>
                <TableHeader>Last gift</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {partnerRows.map((partner) => (
                <tr key={partner.name} className="hover:bg-muted/40">
                  <TableCell strong>{partner.name}</TableCell>
                  <TableCell>{partner.country}</TableCell>
                  <TableCell>{partner.level}</TableCell>
                  <TableCell>{partner.lifetime}</TableCell>
                  <TableCell>{partner.lastGift}</TableCell>
                  <TableCell>
                    <StatusBadge label={partner.status} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      </section>
    </DashboardShell>
  );
}
