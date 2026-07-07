import { Bot, Sparkles } from "lucide-react";
import { AiCommandCenter } from "@/components/demo/ai-command-center";
import {
  DataTable,
  MetricCard,
  Panel,
  StatusBadge,
  TableCell,
  TableHeader,
} from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getDashboardOverview } from "@/lib/data";

const stats = [
  {
    label: "Read-only Tools",
    value: "4",
    detail: "Safe first phase",
    tone: "emerald",
    icon: Bot,
  },
  {
    label: "Draft Tools",
    value: "3",
    detail: "Require staff review",
    tone: "amber",
    icon: Sparkles,
  },
  {
    label: "Mutation Tools",
    value: "0",
    detail: "Not enabled for MVP",
    tone: "rose",
    icon: Bot,
  },
  {
    label: "Default Provider",
    value: "TBD",
    detail: "Model-agnostic via AI SDK",
    tone: "violet",
    icon: Sparkles,
  },
];

const workflows = [
  [
    "Partner briefing",
    "Summarize giving, notes, prayer, and contact history before a call",
    "Read-only",
    "Approved",
  ],
  [
    "Segment builder",
    "Turn plain language into reviewable filters",
    "Draft",
    "Draft",
  ],
  [
    "Message drafting",
    "Create WhatsApp, SMS, and email variants from campaign updates",
    "Draft",
    "Draft",
  ],
  [
    "Payment reconciliation",
    "Match import rows and flag ambiguous donations",
    "Draft",
    "Review",
  ],
  [
    "Follow-up suggestions",
    "Suggest tasks from missed giving and open prayer requests",
    "Draft",
    "Review",
  ],
];

const guardrails = [
  [
    "No unsupervised sends",
    "AI can draft messages, but staff approves outbound communication.",
  ],
  [
    "No RLS bypass",
    "AI tools must use the same data access permissions as the staff user.",
  ],
  [
    "Audit every accepted action",
    "Accepted suggestions become explicit staff-approved actions.",
  ],
];

export default async function AiPage() {
  const { navItems } = await getDashboardOverview();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Supervised AI"
        title="AI Assist"
        description="A model-agnostic assistant for partner briefings, message drafts, reconciliation suggestions, and follow-up recommendations after the core data is trustworthy."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <AiCommandCenter />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel
          title="AI Workflows"
          eyebrow="Provider-agnostic"
          action="Configure"
        >
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Workflow</TableHeader>
                <TableHeader>Purpose</TableHeader>
                <TableHeader>Risk Level</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {workflows.map(([workflow, purpose, risk, status]) => (
                <tr key={workflow} className="hover:bg-muted/40">
                  <TableCell strong>{workflow}</TableCell>
                  <TableCell>{purpose}</TableCell>
                  <TableCell>{risk}</TableCell>
                  <TableCell>
                    <StatusBadge label={status} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="Guardrails" eyebrow="Human approval" action="Policy">
          <div className="space-y-3">
            {guardrails.map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">{title}</p>
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
