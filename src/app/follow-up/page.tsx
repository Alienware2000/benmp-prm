import { ClipboardList, Plus } from "lucide-react";
import {
  DataTable,
  MetricCard,
  Panel,
  StatusBadge,
  TableCell,
  TableHeader,
} from "@/components/dashboard/primitives";
import { ActionButton, PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getDashboardOverview } from "@/lib/data";

const stats = [
  {
    label: "Open Tasks",
    value: "186",
    detail: "Across all teams",
    tone: "blue",
    icon: ClipboardList,
  },
  {
    label: "High Priority",
    value: "24",
    detail: "Finance and prayer",
    tone: "rose",
    icon: ClipboardList,
  },
  {
    label: "Due Today",
    value: "42",
    detail: "Coordinator queues",
    tone: "amber",
    icon: ClipboardList,
  },
  {
    label: "Completed",
    value: "318",
    detail: "This month",
    tone: "emerald",
    icon: ClipboardList,
  },
];

const tasks = [
  [
    "Pastor Kwame Mensah",
    "Recurring gift failed",
    "Finance",
    "WhatsApp",
    "High",
    "Open",
  ],
  [
    "Angela Boateng",
    "Prayer request awaiting response",
    "Prayer team",
    "Email",
    "Medium",
    "Open",
  ],
  [
    "Jean Kouadio",
    "New partner welcome call",
    "Regional coordinator",
    "Phone",
    "Medium",
    "Open",
  ],
  [
    "Marie N'Guessan",
    "Missed quarterly gift",
    "Finance",
    "SMS",
    "High",
    "Review",
  ],
];

const outcomes = [
  ["Thanked partner after donation", "142", "Automated draft, staff-approved"],
  ["Prayer responses sent", "51", "Prayer team queue"],
  ["Failed gift follow-ups", "37", "Finance review"],
];

export default async function FollowUpPage() {
  const { navItems } = await getDashboardOverview();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Relationship care"
        title="Follow-up"
        description="Turn missed giving, new partner welcomes, prayer requests, and campaign updates into owned staff tasks."
      >
        <ActionButton icon={Plus} primary>
          New Task
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Task Queue" eyebrow="Staff-owned work" action="Assign">
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Partner</TableHeader>
                <TableHeader>Reason</TableHeader>
                <TableHeader>Owner</TableHeader>
                <TableHeader>Channel</TableHeader>
                <TableHeader>Priority</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {tasks.map(
                ([partner, reason, owner, channel, priority, status]) => (
                  <tr
                    key={`${partner}-${reason}`}
                    className="hover:bg-muted/40"
                  >
                    <TableCell strong>{partner}</TableCell>
                    <TableCell>{reason}</TableCell>
                    <TableCell>{owner}</TableCell>
                    <TableCell>{channel}</TableCell>
                    <TableCell>{priority}</TableCell>
                    <TableCell>
                      <StatusBadge label={status} />
                    </TableCell>
                  </tr>
                ),
              )}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="This Month" eyebrow="Completed care" action="Report">
          <div className="space-y-3">
            {outcomes.map(([label, count, detail]) => (
              <div key={label} className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {count}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </DashboardShell>
  );
}
