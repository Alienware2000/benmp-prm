import { Plus } from "lucide-react";
import {
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { ActionButton, PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getPrayerView } from "@/lib/data";

export default async function PrayerPage() {
  const { navItems, metrics, requests, queues } = await getPrayerView();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Prayer care"
        title="Prayer Requests"
        description="Record prayer needs, protect sensitive details, assign prayer team follow-up, and surface testimonies when partners report answered prayer."
      >
        <ActionButton icon={Plus} primary>
          New Request
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Prayer Queue" eyebrow="Partner care">
          <ResponsiveRecordTable
            rows={requests}
            getRowKey={(request) => request.id}
            getTitle={(request) => request.partnerName}
            getSubtitle={(request) =>
              `${request.country} - ${request.createdAt}`
            }
            getStatus={(request) => request.status}
            minWidth="900px"
            columns={[
              {
                header: "Partner",
                primary: true,
                render: (request) => request.partnerName,
              },
              { header: "Country", render: (request) => request.country },
              { header: "Request", render: (request) => request.request },
              { header: "Owner", render: (request) => request.owner },
              {
                header: "Sensitivity",
                render: (request) => (
                  <StatusBadge label={request.sensitivity} />
                ),
              },
              {
                header: "Next Action",
                render: (request) => request.nextAction,
              },
              {
                header: "Status",
                render: (request) => <StatusBadge label={request.status} />,
              },
            ]}
          />
        </Panel>

        <Panel title="Care Routing" eyebrow="Team workflows">
          <div className="space-y-3">
            {queues.map((item) => (
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
    </DashboardShell>
  );
}
