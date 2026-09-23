import { Suspense } from "react";
import { UsersRound } from "lucide-react";
import { MetricCard } from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { TodayWorkspace } from "@/components/workspace/today-workspace";
import {
  getCommunicationView,
  getDashboardOverview,
  getGivingView,
} from "@/lib/data";
import {
  getDashboardPartners,
  getDashboardPartnerCount,
} from "@/lib/data/dashboard-partners";

export const dynamic = "force-dynamic";

export default async function Home() {
  const communicationView = await getCommunicationView();
  const givingView = await getGivingView();
  const overview = await getDashboardOverview();

  // Pull hub-admin-ingested partners from Supabase (replaces mock partnerRows).
  // Falls back to mock data when Supabase env is absent.
  const [livePartners, liveCount] = await Promise.all([
    getDashboardPartners(),
    getDashboardPartnerCount(),
  ]);
  const partnerRows =
    livePartners.length > 0 ? livePartners : overview.partnerRows;

  // Swap the first metric to reflect the real partner count when we have it.
  const metrics = liveCount > 0
    ? overview.metrics.map((m, i) =>
        i === 0
          ? {
              ...m,
              label: "Total Partners",
              value: liveCount.toLocaleString(),
              detail: "From hub ingest",
              icon: UsersRound,
              tone: "blue" as const,
            }
          : m,
      )
    : overview.metrics;

  return (
    <DashboardShell navItems={overview.navItems}>
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
          initialTasks={overview.priorities}
          initialMessages={communicationView.batches}
          segments={communicationView.segments}
        />
      </Suspense>
    </DashboardShell>
  );
}
