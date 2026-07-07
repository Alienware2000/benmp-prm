import {
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getAiOperationsView } from "@/lib/data";

export default async function AiPage() {
  const { navItems, metrics, workflows, guardrails, providers } =
    await getAiOperationsView();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Supervised AI"
        title="AI Assist"
        description="A model-agnostic assistant layer for partner briefing, draft generation, import matching, and recommendations after the core data and permissions are trustworthy."
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="AI Tool Registry" eyebrow="Model-agnostic workflows">
          <ResponsiveRecordTable
            rows={workflows}
            getRowKey={(workflow) => workflow.name}
            getTitle={(workflow) => workflow.name}
            getSubtitle={(workflow) => workflow.purpose}
            getStatus={(workflow) => workflow.status}
            minWidth="900px"
            columns={[
              {
                header: "Workflow",
                primary: true,
                render: (workflow) => workflow.name,
              },
              { header: "Purpose", render: (workflow) => workflow.purpose },
              { header: "Risk", render: (workflow) => workflow.riskLevel },
              {
                header: "Approval Policy",
                render: (workflow) => workflow.approvalPolicy,
              },
              {
                header: "Status",
                render: (workflow) => <StatusBadge label={workflow.status} />,
              },
            ]}
          />
        </Panel>

        <Panel title="Guardrails" eyebrow="Before autonomy">
          <div className="space-y-3">
            {guardrails.map((item) => (
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

      <Panel title="Model Providers" eyebrow="Provider abstraction">
        <ResponsiveRecordTable
          rows={providers}
          getRowKey={(provider) => provider.providerKey}
          getTitle={(provider) => provider.name}
          getSubtitle={(provider) => provider.detail}
          getStatus={(provider) => provider.status}
          columns={[
            {
              header: "Provider",
              primary: true,
              render: (provider) => provider.name,
            },
            { header: "Key", render: (provider) => provider.providerKey },
            { header: "Detail", render: (provider) => provider.detail },
            {
              header: "Status",
              render: (provider) => <StatusBadge label={provider.status} />,
            },
          ]}
        />
      </Panel>
    </DashboardShell>
  );
}
