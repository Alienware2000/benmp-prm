import { ShieldCheck, UsersRound } from "lucide-react";
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
    label: "Staff Roles",
    value: "7",
    detail: "Planned permission groups",
    tone: "blue",
    icon: UsersRound,
  },
  {
    label: "Data Provider",
    value: "Mock",
    detail: "No database required for demo",
    tone: "emerald",
    icon: ShieldCheck,
  },
  {
    label: "Messaging Provider",
    value: "Mock",
    detail: "No real messages sent",
    tone: "amber",
    icon: ShieldCheck,
  },
  {
    label: "Audit Policy",
    value: "Planned",
    detail: "Before production data",
    tone: "violet",
    icon: ShieldCheck,
  },
];

const roles = [
  ["Super admin", "Full access and configuration", "Planned"],
  ["Finance", "Giving, imports, failed payments", "Planned"],
  ["Communications", "Segments, templates, message approvals", "Planned"],
  ["Regional coordinator", "Country-scoped partners and follow-up", "Planned"],
  ["Prayer team", "Prayer requests and sensitive care queues", "Planned"],
  ["Viewer", "Read-only dashboards and reports", "Planned"],
];

const adapterStatus = [
  ["Data adapter", "mock", "Active"],
  ["Supabase repository", "supabase", "Draft"],
  ["Generic Postgres repository", "postgres", "Draft"],
  ["Messaging adapter", "mock", "Active"],
  ["Twilio adapter", "twilio", "Draft"],
  ["Meta Cloud API adapter", "meta-cloud-api", "Draft"],
];

export default async function AdminPage() {
  const { navItems } = await getDashboardOverview();

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="System administration"
        title="Admin"
        description="Configure staff roles, data providers, messaging adapters, audit policies, import rules, and regional access boundaries."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel
          title="Role Model"
          eyebrow="Access planning"
          action="Invite staff"
        >
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Role</TableHeader>
                <TableHeader>Scope</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {roles.map(([role, scope, status]) => (
                <tr key={role} className="hover:bg-muted/40">
                  <TableCell strong>{role}</TableCell>
                  <TableCell>{scope}</TableCell>
                  <TableCell>
                    <StatusBadge label={status} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="Adapter Status" eyebrow="Provider strategy" action="Docs">
          <DataTable>
            <thead className="bg-muted/70">
              <tr>
                <TableHeader>Adapter</TableHeader>
                <TableHeader>Provider Key</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {adapterStatus.map(([adapter, key, status]) => (
                <tr key={`${adapter}-${key}`} className="hover:bg-muted/40">
                  <TableCell strong>{adapter}</TableCell>
                  <TableCell>{key}</TableCell>
                  <TableCell>
                    <StatusBadge label={status} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      </section>
    </DashboardShell>
  );
}
