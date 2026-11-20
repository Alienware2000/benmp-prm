import Link from "next/link";
import { cookies } from "next/headers";
import { Building2, CalendarRange, Users } from "lucide-react";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import { getHubMonthlyInput, getHubSummary } from "@/lib/hub/db";
import { buildHubMonth } from "@/lib/hub/monthly";

export const dynamic = "force-dynamic";

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Hub home (Decisions 0032, 0044): the hub's registered partners and churches,
 * and how many churches have sent this month's Monthly Summary Form. Statement
 * giving is tracked by the office on its own and is not shown here.
 */
export default async function HubDashboardPage() {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  const month = new Date().toISOString().slice(0, 7);
  const [summary, input] = session
    ? await Promise.all([
        getHubSummary(session.hubId),
        getHubMonthlyInput(session.hubId, month),
      ])
    : [null, null];

  if (!session || !summary || !input) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load this hub. Sign out and back in, or contact the BENMP
        office.
      </p>
    );
  }

  const m = buildHubMonth(input, month);
  const churches = m.filed.length + m.notFiled.length;
  const tiles = [
    {
      label: "Registered partners",
      value: summary.partnerCount.toLocaleString(),
      note: "On your partner list",
      icon: Users,
    },
    {
      label: "Churches",
      value: summary.churchCount.toLocaleString(),
      note: "In this hub",
      icon: Building2,
    },
    {
      label: `${monthLabel(month)} forms`,
      value: `${m.filed.length} of ${churches}`,
      note:
        m.notFiled.length === 0
          ? churches > 0
            ? "Every church has submitted"
            : "No churches yet"
          : `${m.notFiled.length} still to submit`,
      icon: CalendarRange,
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/hub/summary"
          className="rounded border border-brand px-3 py-1.5 font-semibold text-brand hover:bg-brand/5"
        >
          Monthly summary
        </Link>
        <Link
          href="/hub/partners"
          className="rounded border border-border px-3 py-1.5 font-semibold text-foreground hover:bg-muted"
        >
          Your partners
        </Link>
        <Link
          href="/hub/upload"
          className="rounded border border-border px-3 py-1.5 font-semibold text-foreground hover:bg-muted"
        >
          Upload partners
        </Link>
      </div>
    </div>
  );
}
