import { FileUp, Plus, UsersRound } from "lucide-react";
import { PartnerIntelligence } from "@/components/demo/partner-intelligence";
import { MetricCard } from "@/components/dashboard/primitives";
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

      <PartnerIntelligence />
    </DashboardShell>
  );
}
