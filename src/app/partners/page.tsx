import { FileUp, Plus, UsersRound } from "lucide-react";
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

const partnerStats = [
  {
    label: "Searchable Partners",
    value: "12,842",
    detail: "Mock repository",
    tone: "blue",
    icon: UsersRound,
  },
  {
    label: "Monthly Partners",
    value: "7,316",
    detail: "Primary stewardship segment",
    tone: "emerald",
    icon: UsersRound,
  },
  {
    label: "Needs Follow-up",
    value: "428",
    detail: "Missed giving or prayer response",
    tone: "amber",
    icon: UsersRound,
  },
  {
    label: "Major Partners",
    value: "94",
    detail: "High-touch relationship queue",
    tone: "violet",
    icon: UsersRound,
  },
];

const partners = [
  ["Ama Serwaa", "Ghana", "Accra", "WhatsApp", "Monthly", "Active"],
  ["Daniel Okafor", "Nigeria", "Lagos", "Email", "Major", "Active"],
  ["Marie N'Guessan", "Cote d'Ivoire", "Abidjan", "SMS", "Quarterly", "Missed"],
  ["Samuel Tetteh", "United States", "Dallas", "Phone", "Prayer", "New"],
  ["Angela Boateng", "United Kingdom", "London", "Email", "Monthly", "Active"],
];

const segments = [
  ["Ghana monthly partners", "3,240", "Thank-you message"],
  ["New partners", "326", "Welcome sequence"],
  ["Missed 60 days", "428", "Gentle follow-up"],
  ["Major partners", "94", "Crusade report"],
];

export default async function PartnersPage() {
  const { navItems } = await getDashboardOverview();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Partner database"
        title="Partners"
        description="A single staff-facing record for each partner: contact details, giving relationship, country, church, notes, prayer needs, and follow-up ownership."
      >
        <ActionButton icon={FileUp}>Import CSV</ActionButton>
        <ActionButton icon={Plus} primary>
          New Partner
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {partnerStats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Partner Directory" eyebrow="Core records" action="Filter">
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Name</TableHeader>
                <TableHeader>Country</TableHeader>
                <TableHeader>City</TableHeader>
                <TableHeader>Preferred Contact</TableHeader>
                <TableHeader>Level</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {partners.map(([name, country, city, contact, level, status]) => (
                <tr key={name} className="hover:bg-muted/40">
                  <TableCell strong>{name}</TableCell>
                  <TableCell>{country}</TableCell>
                  <TableCell>{city}</TableCell>
                  <TableCell>{contact}</TableCell>
                  <TableCell>{level}</TableCell>
                  <TableCell>
                    <StatusBadge label={status} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="Useful Segments" eyebrow="Ready views" action="Build">
          <div className="space-y-3">
            {segments.map(([name, count, use]) => (
              <div key={name} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{use}</p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{count}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </DashboardShell>
  );
}
