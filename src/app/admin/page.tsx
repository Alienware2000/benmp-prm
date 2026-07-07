import {
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getAdminView } from "@/lib/data";

export default async function AdminPage() {
  const { navItems, metrics, roles, providers, backendReadiness } =
    await getAdminView();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="System administration"
        title="Admin"
        description="Configure staff roles, data providers, messaging adapters, audit policies, import rules, and regional access boundaries before production data goes live."
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Role Model" eyebrow="Access boundaries">
          <ResponsiveRecordTable
            rows={roles}
            getRowKey={(role) => role.role}
            getTitle={(role) => role.role}
            getSubtitle={(role) => role.scope}
            getStatus={(role) => role.status}
            columns={[
              { header: "Role", primary: true, render: (role) => role.role },
              { header: "Scope", render: (role) => role.scope },
              {
                header: "Status",
                render: (role) => <StatusBadge label={role.status} />,
              },
            ]}
          />
        </Panel>

        <Panel title="Backend Readiness" eyebrow="Go-live checklist">
          <div className="space-y-3">
            {backendReadiness.map((item) => (
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

      <Panel title="Adapter Status" eyebrow="Provider strategy">
        <ResponsiveRecordTable
          rows={providers}
          getRowKey={(provider) => provider.providerKey}
          getTitle={(provider) => provider.name}
          getSubtitle={(provider) => provider.detail}
          getStatus={(provider) => provider.status}
          columns={[
            {
              header: "Adapter",
              primary: true,
              render: (provider) => provider.name,
            },
            {
              header: "Provider Key",
              render: (provider) => provider.providerKey,
            },
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
