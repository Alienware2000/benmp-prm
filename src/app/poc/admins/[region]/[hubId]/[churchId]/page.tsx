import { notFound } from "next/navigation";
import {
  getChurchMemberInput,
  getHubSummary,
  getRegionMomoRequired,
} from "@/lib/hub/db";
import { buildChurchMemberView } from "@/lib/hub/church-members";
import { monthsEndingAt } from "@/lib/hub/monthly";
import { ADMIN_BLOCKS, resolveMonth } from "@/lib/poc/admins-overview";
import {
  DownloadGiversLink,
  FormLine,
  MemberMonthGrid,
} from "@/components/giving/member-month-grid";
import { Crumbs, MonthPicker, money, monthLabel } from "../../../ui";

export const dynamic = "force-dynamic";

/** Months shown across the member table, ending at the chosen month. */
const GRID_MONTHS = 6;

/**
 * Office Admins tab, branch level (Decision 0040): one church, member by
 * member, month by month. Block -> hub -> branch -> members.
 */
export default async function AdminsChurchPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; hubId: string; churchId: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const { region, hubId, churchId } = await params;
  const code = region.toUpperCase();
  const month = resolveMonth((await searchParams).month);
  const months = monthsEndingAt(month, GRID_MONTHS);
  const [hub, input, reportsCash] = await Promise.all([
    getHubSummary(hubId),
    getChurchMemberInput(hubId, churchId, months[0]),
    getRegionMomoRequired(code),
  ]);
  if (!hub || hub.regionCode !== code || !input) notFound();

  const view = buildChurchMemberView(input, months);
  const blockLabel =
    ADMIN_BLOCKS.find((b) => b.regionCode === code)?.label ?? hub.regionName;
  const regionPath = `/poc/admins/${code.toLowerCase()}`;
  const stats = [
    { label: "Members", value: view.members.length.toLocaleString("en-US") },
    {
      label: `Gave in ${monthLabel(month)}`,
      value: view.giversByMonth[month].toLocaleString("en-US"),
    },
    {
      label: `Giving in ${monthLabel(month)}`,
      value: money(view.monthTotals[month]),
    },
    {
      label: `Giving over ${GRID_MONTHS} months`,
      value: money(view.totalMinor),
    },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 lg:pb-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <Crumbs
          month={month}
          trail={[
            { label: blockLabel, href: `${regionPath}?month=${month}` },
            {
              label: hub.hubLabel,
              href: `${regionPath}/${hubId}?month=${month}`,
            },
            { label: input.church.name },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {input.church.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pastor: {input.church.leader_name || "not on record"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MonthPicker
              month={month}
              action={`${regionPath}/${hubId}/${churchId}`}
            />
            <DownloadGiversLink
              href={`/api/poc/givers?hubId=${hubId}&churchId=${churchId}&month=${month}`}
              month={month}
            />
          </div>
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
    </div>
  );
}
