import { Globe2, Plus } from "lucide-react";
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
    label: "Active Campaigns",
    value: "3",
    detail: "Live or preparing",
    tone: "emerald",
    icon: Globe2,
  },
  {
    label: "Partner Support",
    value: "2,370",
    detail: "Attached to campaigns",
    tone: "blue",
    icon: Globe2,
  },
  {
    label: "Reports Due",
    value: "2",
    detail: "For partner updates",
    tone: "amber",
    icon: Globe2,
  },
  {
    label: "Countries",
    value: "41",
    detail: "Campaign footprint",
    tone: "violet",
    icon: Globe2,
  },
];

const campaigns = [
  [
    "Healing Jesus Campaign Banjul",
    "The Gambia",
    "Jul 7-10, 2026",
    "1,120",
    "72%",
    "Live",
  ],
  [
    "Healing Jesus Campaign Assomada",
    "Cape Verde",
    "Jul 15-17, 2026",
    "740",
    "48%",
    "Preparing",
  ],
  [
    "Give Thyself Wholly Conference",
    "Ghana",
    "Aug 4-7, 2026",
    "510",
    "39%",
    "Preparing",
  ],
];

const reports = [
  ["Banjul nightly update", "WhatsApp + email", "Draft"],
  ["Assomada pre-crusade appeal", "Major partners", "Review"],
  ["Monthly testimony digest", "All monthly partners", "Queued"],
];

export default async function CampaignsPage() {
  const { navItems } = await getDashboardOverview();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Crusades and reports"
        title="Campaigns"
        description="Track upcoming crusades, partner support, funding progress, reports, testimonies, and campaign-specific communication."
      >
        <ActionButton icon={Plus} primary>
          New Campaign
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Campaign List" eyebrow="Support view" action="Open map">
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Campaign</TableHeader>
                <TableHeader>Country</TableHeader>
                <TableHeader>Dates</TableHeader>
                <TableHeader>Partners</TableHeader>
                <TableHeader>Goal</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {campaigns.map(
                ([name, country, dates, partners, goal, status]) => (
                  <tr key={name} className="hover:bg-muted/40">
                    <TableCell strong>{name}</TableCell>
                    <TableCell>{country}</TableCell>
                    <TableCell>{dates}</TableCell>
                    <TableCell>{partners}</TableCell>
                    <TableCell>{goal}</TableCell>
                    <TableCell>
                      <StatusBadge label={status} />
                    </TableCell>
                  </tr>
                ),
              )}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="Partner Updates" eyebrow="Report pipeline" action="Draft">
          <div className="space-y-3">
            {reports.map(([name, audience, status]) => (
              <div key={name} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {audience}
                    </p>
                  </div>
                  <StatusBadge label={status} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </DashboardShell>
  );
}
