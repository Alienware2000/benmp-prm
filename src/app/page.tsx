import { Suspense } from "react";
import { MetricCard } from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { TodayWorkspace } from "@/components/workspace/today-workspace";
import {
  getCommunicationView,
  getDashboardOverview,
  getGivingView,
} from "@/lib/data";

export default async function Home() {
  const communicationView = await getCommunicationView();
  const givingView = await getGivingView();
  const { navItems, metrics, priorities, partnerRows } =
    await getDashboardOverview();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Global Crusade Partners Platform"
        title="Today"
        description="Daily office command center for donation intake, instant acknowledgement, partner care, and message approvals."
      />

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
          initialGifts={givingView.contributions}
          initialTasks={priorities}
          initialMessages={communicationView.batches}
          segments={communicationView.segments}
        />
      </Suspense>
    </DashboardShell>
  );
}
