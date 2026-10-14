import { cookies } from "next/headers";
import { CalendarClock, HandCoins, UserCheck, Users } from "lucide-react";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import {
  getHubPartners,
  getHubSummary,
  getLatestPaymentDate,
  getPaymentsForPartners,
} from "@/lib/hub/db";
import { summarizeHubGiving } from "@/lib/hub/giving";
import { GiversList } from "./givers-list";

export const dynamic = "force-dynamic";

const ghs = (minor: number) =>
  `GHS ${(minor / 100).toLocaleString("en-GH", { maximumFractionDigits: 0 })}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Hub home (Decision 0032): the hub's own partners and who among them is giving.
 * Hub-scoped by the session; giving comes from payments matched to this hub's
 * partners. Uploading moved to /hub/upload.
 */
export default async function HubDashboardPage() {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  const [summary, partners, latestPayment] = session
    ? await Promise.all([
        getHubSummary(session.hubId),
        getHubPartners(session.hubId),
        getLatestPaymentDate(),
      ])
    : [null, [], null];

  if (!session || !summary) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load this hub. Sign out and back in, or contact the BENMP
        office.
      </p>
    );
  }

  const payments = await getPaymentsForPartners(partners.map((p) => p.id));
  const giving = summarizeHubGiving(
    partners.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      phone: p.momo_phone_number || p.whatsapp_number || null,
      church: p.church,
    })),
    payments,
    new Date(),
  );

  const tiles = [
    {
      label: "Partners",
      value: giving.partnerCount.toLocaleString(),
      note: `${summary.churchCount} churches`,
      icon: Users,
    },
    {
      label: "Active partners",
      value: giving.activeCount.toLocaleString(),
      note: `Gave since ${fmtDate(giving.activeSince)}`,
      icon: UserCheck,
    },
    {
      label: "Given since " + fmtDate(giving.activeSince).replace(/^\d+ /, ""),
      value: ghs(giving.activeWindowMinor),
      note: `${ghs(giving.yearMinor)} this year`,
      icon: HandCoins,
    },
    {
      label: "Lapsed",
      value: giving.lapsedCount.toLocaleString(),
      note: `${giving.neverCount.toLocaleString()} have not given yet`,
      icon: CalendarClock,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {summary.hubLabel}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.regionName}
          {summary.leaderName ? ` · Led by ${summary.leaderName}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, note, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Active means a gift by MoMo, bank or Paystack in this month or the two
        before it, matched to a partner by phone number.
        {latestPayment
          ? ` Statements are recorded up to ${fmtDate(latestPayment)}.`
          : ""}
      </p>

      {giving.partnerCount === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
          No partners yet. Use the Upload tab to add your first list.
        </p>
      ) : (
        <GiversList givers={giving.givers} />
      )}
    </div>
  );
}
