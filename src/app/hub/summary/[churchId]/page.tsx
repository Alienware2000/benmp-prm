import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import { getChurchMemberInput, getRegionMomoRequired } from "@/lib/hub/db";
import { buildChurchMemberView } from "@/lib/hub/church-members";
import { monthsEndingAt } from "@/lib/hub/monthly";
import { resolveMonth } from "@/lib/poc/admins-overview";
import {
  FormLine,
  MemberMonthGrid,
} from "@/components/giving/member-month-grid";

export const dynamic = "force-dynamic";

/** Months shown across the member table, ending at the chosen month. */
const GRID_MONTHS = 6;

const ghs = (minor: number) =>
  `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * One of the hub's churches, member by member, month by month (Decision 0040).
 * The church must belong to the signed-in hub, or the page is not found.
 */
export default async function HubChurchPage({
  params,
  searchParams,
}: {
  params: Promise<{ churchId: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const { churchId } = await params;
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  if (!session) notFound();
  const month = resolveMonth((await searchParams).month);
  const months = monthsEndingAt(month, GRID_MONTHS);
  const [input, reportsCash] = await Promise.all([
    getChurchMemberInput(session.hubId, churchId, months[0]),
    getRegionMomoRequired(session.regionCode),
  ]);
  if (!input) notFound();

  const view = buildChurchMemberView(input, months);
  const stats = [
    { label: "Members", value: view.members.length.toLocaleString("en-US") },
    {
      label: `Gave in ${monthLabel(month)}`,
      value: view.giversByMonth[month].toLocaleString("en-US"),
    },
    {
      label: `Giving in ${monthLabel(month)}`,
      value: ghs(view.monthTotals[month]),
    },
    { label: `Giving over ${GRID_MONTHS} months`, value: ghs(view.totalMinor) },
  ];

  return (
    <div className="space-y-5">
      <Link
        href={`/hub/summary?month=${month}`}
        className="text-sm text-brand hover:underline"
      >
        ← Monthly summary
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {input.church.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {input.church.leader_name || "Pastor not on record"} ·{" "}
            {session.hubLabel}
          </p>
        </div>
        <form
          action={`/hub/summary/${churchId}`}
          className="flex items-center gap-2"
        >
          <label htmlFor="month" className="text-sm text-muted-foreground">
            Month
          </label>
          <input
            id="month"
            name="month"
            type="month"
            defaultValue={month}
            className="rounded border border-border bg-input px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Show
          </button>
        </form>
      </div>

      <FormLine view={view} month={month} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      <MemberMonthGrid
        view={view}
        selectedMonth={month}
        reportsCash={reportsCash}
      />

      <p className="text-xs text-muted-foreground">
        Amounts are GHS from MoMo, bank and Paystack gifts matched to each
        member, by the month the money arrived.
        {reportsCash
          ? " Cash on the Monthly Summary Form is reported for the church as a whole, so it is shown on its own line."
          : ""}
      </p>
    </div>
  );
}
