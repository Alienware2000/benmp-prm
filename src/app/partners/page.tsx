import { FileUp, Plus } from "lucide-react";
import Link from "next/link";
import {
  MetricCard,
  Panel,
  ResponsiveRecordTable,
  StatusBadge,
} from "@/components/dashboard/primitives";
import { ActionButton, PageHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getPartnersView } from "@/lib/data";
import { minorCurrency } from "@/lib/utils";

type PartnersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnersPage({
  searchParams,
}: PartnersPageProps) {
  const { navItems, metrics, partners, segments, onboardingChecklist } =
    await getPartnersView();
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q)?.trim() ?? "";
  const activeFilter = firstParam(params.filter) ?? "All";
  const normalizedQuery = query.toLowerCase();
  const filteredPartners = partners.filter((partner) => {
    const matchesFilter =
      activeFilter === "All" ||
      partner.partnershipLevel === activeFilter ||
      partner.status === activeFilter;
    const matchesQuery =
      !normalizedQuery ||
      [
        partner.fullName,
        partner.country,
        partner.city,
        partner.church,
        partner.email,
        partner.mobileNumber,
        partner.whatsappNumber,
        partner.owner,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesFilter && matchesQuery;
  });

  return (
    <DashboardShell navItems={navItems}>
      <PageHeader
        eyebrow="Partner database"
        title="Partners"
        description="Staff records for contact details, church, country, giving relationship, prayer care, notes, ownership, and communication preferences."
      >
        <ActionButton icon={FileUp}>Import CSV</ActionButton>
        <ActionButton icon={Plus} href="/?mode=partner#workspace" primary>
          New Partner
        </ActionButton>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <Panel title="Partner Directory" eyebrow="Operational records">
        <form className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            name="q"
            defaultValue={query}
            className="h-10 rounded-lg border border-border bg-muted px-3 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
            placeholder="Search name, country, church, phone, or email"
          />
          {activeFilter !== "All" ? (
            <input type="hidden" name="filter" value={activeFilter} />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {["All", "Monthly", "Major", "Needs follow-up", "New"].map(
              (filter) => (
                <Link
                  key={filter}
                  href={{
                    pathname: "/partners",
                    query: {
                      ...(query ? { q: query } : {}),
                      ...(filter === "All" ? {} : { filter }),
                    },
                  }}
                  className={
                    activeFilter === filter
                      ? "inline-flex h-10 items-center rounded-lg border border-sidebar bg-sidebar px-3 text-sm font-semibold text-white"
                      : "inline-flex h-10 items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                  }
                >
                  {filter}
                </Link>
              ),
            )}
            <button className="h-10 rounded-lg bg-sidebar px-3 text-sm font-semibold text-white">
              Search
            </button>
          </div>
        </form>

        <ResponsiveRecordTable
          rows={filteredPartners}
          getRowKey={(partner) => partner.id}
          getTitle={(partner) => partner.fullName}
          getSubtitle={(partner) =>
            `${partner.city}, ${partner.country} - ${partner.preferredCommunication}`
          }
          getStatus={(partner) => partner.status}
          minWidth="900px"
          columns={[
            {
              header: "Partner",
              primary: true,
              render: (partner) => (
                <div>
                  <p>{partner.fullName}</p>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    {partner.church}
                  </p>
                </div>
              ),
            },
            {
              header: "Contact",
              render: (partner) => (
                <div className="space-y-1">
                  <p>{partner.preferredCommunication}</p>
                  <p className="text-xs text-muted-foreground">
                    {partner.whatsappNumber || partner.mobileNumber}
                  </p>
                </div>
              ),
            },
            {
              header: "Location",
              render: (partner) => `${partner.city}, ${partner.country}`,
            },
            {
              header: "Partnership",
              render: (partner) =>
                `${partner.partnershipLevel} / ${partner.givingFrequency}`,
            },
            {
              header: "Giving",
              render: (partner) =>
                `${minorCurrency(
                  partner.lifetimeGiving.amountMinor,
                  partner.lifetimeGiving.currency,
                )} lifetime; last ${partner.lastContributionDate}`,
            },
            { header: "Owner", render: (partner) => partner.owner },
            {
              header: "Status",
              render: (partner) => <StatusBadge label={partner.status} />,
            },
          ]}
        />
      </Panel>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Saved Segments" eyebrow="Communication-ready views">
          <div className="space-y-3">
            {segments.map((segment) => (
              <div
                key={segment.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {segment.name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {segment.description}
                    </p>
                  </div>
                  <StatusBadge label={segment.complianceStatus} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                  <span>
                    {segment.recipientCount.toLocaleString()} recipients
                  </span>
                  <span>{segment.channel}</span>
                  <span>{segment.owner}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Data Readiness" eyebrow="Before real imports">
          <div className="space-y-3">
            {onboardingChecklist.map((item) => (
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
    </DashboardShell>
  );
}
