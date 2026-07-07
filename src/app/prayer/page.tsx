import { HeartHandshake, Plus } from "lucide-react";
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
    label: "Open Requests",
    value: "84",
    detail: "Awaiting prayer team response",
    tone: "blue",
    icon: HeartHandshake,
  },
  {
    label: "Sensitive",
    value: "19",
    detail: "Restricted visibility",
    tone: "rose",
    icon: HeartHandshake,
  },
  {
    label: "Responded",
    value: "51",
    detail: "This month",
    tone: "emerald",
    icon: HeartHandshake,
  },
  {
    label: "Pastoral Follow-up",
    value: "12",
    detail: "Coordinator handoff",
    tone: "amber",
    icon: HeartHandshake,
  },
];

const requests = [
  [
    "Angela Boateng",
    "United Kingdom",
    "Family healing and encouragement",
    "Prayer team",
    "Open",
  ],
  [
    "Samuel Tetteh",
    "United States",
    "New business and ministry direction",
    "Coordinator",
    "Open",
  ],
  [
    "Ama Serwaa",
    "Ghana",
    "Thanksgiving after answered prayer",
    "Prayer team",
    "Responded",
  ],
  [
    "Private partner",
    "Nigeria",
    "Sensitive pastoral request",
    "Senior pastor",
    "Sensitive",
  ],
];

const queues = [
  ["Needs response", "84", "Prayer team can send approved encouragement"],
  ["Escalate to coordinator", "12", "Pastoral or personal follow-up"],
  ["Answered testimonies", "18", "Candidate stories for reports"],
];

export default async function PrayerPage() {
  const { navItems } = await getDashboardOverview();

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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Prayer Queue" eyebrow="Partner requests" action="Assign">
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Partner</TableHeader>
                <TableHeader>Country</TableHeader>
                <TableHeader>Request</TableHeader>
                <TableHeader>Owner</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {requests.map(([partner, country, request, owner, status]) => (
                <tr key={`${partner}-${request}`} className="hover:bg-muted/40">
                  <TableCell strong>{partner}</TableCell>
                  <TableCell>{country}</TableCell>
                  <TableCell>{request}</TableCell>
                  <TableCell>{owner}</TableCell>
                  <TableCell>
                    <StatusBadge label={status} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="Prayer Workflows" eyebrow="Care routing" action="Review">
          <div className="space-y-3">
            {queues.map(([name, count, detail]) => (
              <div key={name} className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">{name}</p>
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
