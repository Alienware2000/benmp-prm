import { MessageCircle, Plus } from "lucide-react";
import { CommunicationStudio } from "@/components/demo/communication-studio";
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
    label: "Queued Drafts",
    value: "6",
    detail: "Waiting for approval",
    tone: "amber",
    icon: MessageCircle,
  },
  {
    label: "WhatsApp Reach",
    value: "8,420",
    detail: "Partners with WhatsApp",
    tone: "emerald",
    icon: MessageCircle,
  },
  {
    label: "SMS Fallback",
    value: "2,180",
    detail: "Usable mobile numbers",
    tone: "blue",
    icon: MessageCircle,
  },
  {
    label: "Email Reach",
    value: "5,936",
    detail: "Newsletter capable",
    tone: "violet",
    icon: MessageCircle,
  },
];

const batches = [
  ["Monthly Thank-you", "Ghana monthly partners", "WhatsApp", "3,240", "Draft"],
  ["Banjul Campaign Report", "Major partners", "Email", "94", "Queued"],
  ["New Partner Welcome", "New partners", "WhatsApp", "326", "Sent"],
  ["Missed 60 Days", "Lapsed partners", "SMS", "428", "Review"],
];

const providers = [
  ["Mock adapter", "Active for MVP", "No real messages sent"],
  ["Twilio", "Pilot option", "WhatsApp, SMS, voice in one provider"],
  ["Meta Cloud API", "Long-term option", "Direct WhatsApp Business ownership"],
];

export default async function CommunicationPage() {
  const { navItems } = await getDashboardOverview();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Communication"
        title="Messaging Center"
        description="Build partner segments, draft messages, approve batches, and send through WhatsApp, SMS, or email provider adapters."
      >
        <ActionButton icon={Plus} primary>
          New Message
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <CommunicationStudio />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel
          title="Message Batches"
          eyebrow="Approval required"
          action="Templates"
        >
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Batch</TableHeader>
                <TableHeader>Segment</TableHeader>
                <TableHeader>Channel</TableHeader>
                <TableHeader>Recipients</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {batches.map(([batch, segment, channel, recipients, status]) => (
                <tr key={batch} className="hover:bg-muted/40">
                  <TableCell strong>{batch}</TableCell>
                  <TableCell>{segment}</TableCell>
                  <TableCell>{channel}</TableCell>
                  <TableCell>{recipients}</TableCell>
                  <TableCell>
                    <StatusBadge label={status} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="Provider Adapter" eyebrow="No lock-in" action="Configure">
          <div className="space-y-3">
            {providers.map(([name, status, detail]) => (
              <div key={name} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {name}
                  </p>
                  <span className="text-xs font-medium text-muted-foreground">
                    {status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
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
