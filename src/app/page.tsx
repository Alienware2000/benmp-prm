import type { ComponentType } from "react";
import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  Download,
  FileUp,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { getDashboardOverview, type NavItem } from "@/lib/data";
import { compactNumber, cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

const metricTones: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
};

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Missed: "bg-rose-50 text-rose-700 ring-rose-100",
  New: "bg-blue-50 text-blue-700 ring-blue-100",
  Live: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Preparing: "bg-amber-50 text-amber-700 ring-amber-100",
};

export default async function Home() {
  const { navItems, metrics, givingTrend, followUps, campaigns, partnerRows } =
    await getDashboardOverview();
  const maxGiving = Math.max(...givingTrend.map((item) => item.amount));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[244px_1fr]">
        <Sidebar navItems={navItems} />

        <section className="min-w-0">
          <Topbar />

          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  BENMP internal
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Global Crusade Partners Platform
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Partner relationships, giving, follow-up, prayer requests, and
                  campaign communication in one staff workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionButton icon={FileUp}>Import</ActionButton>
                <ActionButton icon={Download}>Export</ActionButton>
                <ActionButton icon={Plus} primary>
                  New Partner
                </ActionButton>
              </div>
            </div>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  detail={metric.detail}
                  icon={metric.icon}
                  tone={metric.tone}
                />
              ))}
            </section>

            <section className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-amber-200">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">AI-native direction</p>
                  <p className="mt-1 leading-6 text-amber-900/80">
                    Start with trustworthy partner and giving data. Then add a
                    supervised assistant for partner briefings, message drafts,
                    payment reconciliation, and follow-up suggestions.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.95fr]">
              <Panel
                title="Giving Momentum"
                eyebrow="Last 6 months"
                action="View giving"
              >
                <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
                  <div className="flex h-[244px] items-end gap-3 rounded-lg border border-border bg-muted/40 p-4">
                    {givingTrend.map((item) => (
                      <div
                        key={item.month}
                        className="flex h-full flex-1 flex-col justify-end gap-2"
                      >
                        <div className="flex flex-1 items-end">
                          <div
                            className="w-full rounded-md bg-primary"
                            style={{
                              height: `${Math.max((item.amount / maxGiving) * 100, 12)}%`,
                            }}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {item.month}
                          </p>
                          <p className="text-xs font-semibold tabular-nums text-foreground">
                            {compactNumber(item.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid content-between gap-3">
                    <Insight
                      label="Monthly partners current"
                      value="7,316"
                      detail="Flag missed partners before the month closes."
                    />
                    <Insight
                      label="Due for appreciation"
                      value="3,240"
                      detail="Ghana WhatsApp segment is ready for review."
                    />
                    <Insight
                      label="Needs finance review"
                      value="37"
                      detail="Unmatched donations from imported payment exports."
                    />
                  </div>
                </div>
              </Panel>

              <Panel
                title="Follow-up Queue"
                eyebrow="Today"
                action="Open tasks"
              >
                <div className="divide-y divide-border">
                  {followUps.map((item) => (
                    <div
                      key={item.partner}
                      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar text-white">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {item.partner}
                          </p>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {item.priority}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.reason}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
                          <span>{item.country}</span>
                          <span>{item.channel}</span>
                          <span>{item.owner}</span>
                        </div>
                      </div>
                      <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <Panel
                title="Campaigns"
                eyebrow="Upcoming and live"
                action="Manage"
              >
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.name}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">
                              {campaign.name}
                            </h3>
                            <StatusBadge label={campaign.status} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {campaign.place}
                          </p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            {campaign.dates}
                          </p>
                        </div>
                        <p className="text-right text-xs font-semibold text-foreground">
                          {campaign.partners.toLocaleString()}
                          <span className="block font-medium text-muted-foreground">
                            partners
                          </span>
                        </p>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${campaign.progress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        {campaign.progress}% of current partner support target
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Partner Snapshot"
                eyebrow="Relationship health"
                action="View all"
              >
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full min-w-[680px] border-collapse text-left">
                    <thead className="bg-muted/70">
                      <tr>
                        <TableHeader>Partner</TableHeader>
                        <TableHeader>Country</TableHeader>
                        <TableHeader>Level</TableHeader>
                        <TableHeader>Lifetime</TableHeader>
                        <TableHeader>Last gift</TableHeader>
                        <TableHeader>Status</TableHeader>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {partnerRows.map((partner) => (
                        <tr key={partner.name} className="hover:bg-muted/40">
                          <TableCell strong>{partner.name}</TableCell>
                          <TableCell>{partner.country}</TableCell>
                          <TableCell>{partner.level}</TableCell>
                          <TableCell>{partner.lifetime}</TableCell>
                          <TableCell>{partner.lastGift}</TableCell>
                          <TableCell>
                            <StatusBadge label={partner.status} />
                          </TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({ navItems }: { navItems: NavItem[] }) {
  return (
    <aside className="hidden min-h-screen flex-col bg-sidebar text-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
          <span className="text-sm font-bold">B</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">BENMP PRM</p>
          <p className="truncate text-xs text-white/45">
            Healing Jesus Campaign
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 px-3 py-4">
        <div>
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
            Workspace
          </p>
          <div className="space-y-1">
            {navItems.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                  index === 0
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white/85",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-xs font-semibold text-white">
            Regional coordinator
          </p>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Role-aware access, audit logs, and country scoping are planned in
            Supabase RLS.
          </p>
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar text-sm font-bold text-white lg:hidden">
          B
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
            placeholder="Search partners, countries, campaigns, notes"
          />
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </button>
      </div>
    </header>
  );
}

function ActionButton({
  children,
  icon: IconComponent,
  primary = false,
}: {
  children: React.ReactNode;
  icon: Icon;
  primary?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
        primary
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-white text-foreground hover:bg-muted",
      )}
    >
      <IconComponent className="h-4 w-4" />
      {children}
    </button>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: IconComponent,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: Icon;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg ring-1",
            metricTones[tone],
          )}
        >
          <IconComponent className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {title}
          </h2>
        </div>
        <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
          {action}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </section>
  );
}

function Insight({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ring-1",
        statusStyles[label],
      )}
    >
      {label}
    </span>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  );
}

function TableCell({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm text-muted-foreground",
        strong && "font-semibold text-foreground",
      )}
    >
      {children}
    </td>
  );
}
