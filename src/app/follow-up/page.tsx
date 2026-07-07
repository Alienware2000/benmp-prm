import { Plus } from "lucide-react";
import {
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { ActionButton, PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getFollowUpView } from "@/lib/data";

export default async function FollowUpPage() {
  const { navItems, metrics, tasks, outcomes } = await getFollowUpView();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Relationship care"
        title="Follow-up"
        description="Convert missed giving, new partner welcomes, prayer requests, campaign reports, and failed payments into owned staff tasks."
      >
        <ActionButton icon={Plus} href="/?mode=task#workspace" primary>
          New Task
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="Task Queue" eyebrow="Staff-owned work">
          <ResponsiveRecordTable
            rows={tasks}
            getRowKey={(task) => task.id}
            getTitle={(task) => task.partnerName}
            getSubtitle={(task) => `${task.reason} - ${task.channel}`}
            getStatus={(task) => task.status}
            minWidth="980px"
            columns={[
              {
                header: "Partner",
                primary: true,
                render: (task) => task.partnerName,
              },
              { header: "Reason", render: (task) => task.reason },
              { header: "Source", render: (task) => task.source },
              { header: "Owner", render: (task) => task.owner },
              { header: "Channel", render: (task) => task.channel },
              { header: "Priority", render: (task) => task.priority },
              { header: "Due", render: (task) => task.dueOn },
              { header: "Next Action", render: (task) => task.nextAction },
              {
                header: "Status",
                render: (task) => <StatusBadge label={task.status} />,
              },
            ]}
          />
        </Panel>

        <Panel title="This Month" eyebrow="Completed care">
          <div className="space-y-3">
            {outcomes.map((item) => (
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
