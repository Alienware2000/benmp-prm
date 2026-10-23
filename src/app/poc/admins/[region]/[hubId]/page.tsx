import { notFound } from "next/navigation";
import { loadAdminsInput } from "@/lib/poc/admins-data";
import {
  ADMIN_BLOCKS,
  buildHubReport,
  resolveMonth,
} from "@/lib/poc/admins-overview";
import {
  Crumbs,
  MonthPicker,
  Stat,
  dateLabel,
  money,
  monthLabel,
  ofTotal,
} from "../../ui";

export const dynamic = "force-dynamic";

export default async function AdminsHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; hubId: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const { region, hubId } = await params;
  const code = region.toUpperCase();
  const month = resolveMonth((await searchParams).month);
  const input = await loadAdminsInput(month);
  const report = buildHubReport(input, month, hubId);
  if (!report || report.hub.regionCode !== code) notFound();

  const { hub, branches, noBranchGivingMinor } = report;
  const regionName = input.regions.find((r) => r.code === code)?.name ?? code;
  const blockLabel =
    ADMIN_BLOCKS.find((b) => b.regionCode === code)?.label ?? regionName;
  const regionHref = `/poc/admins/${code.toLowerCase()}?month=${month}`;
  const cash = ofTotal(hub.cashFiled, hub.branches);

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 lg:pb-8">
      <div className="mx-auto max-w-6xl">
        <Crumbs
          month={month}
          trail={[
            { label: blockLabel, href: regionHref },
            { label: hub.label },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{hub.label}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin: {hub.adminName || "no name on record"}. Last sign-in:{" "}
              {dateLabel(hub.lastSignIn)}.
            </p>
          </div>
          <MonthPicker
            month={month}
            action={`/poc/admins/${code.toLowerCase()}/${hubId}`}
          />
        </div>

        <div className="mt-6 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Partners" value={hub.partners.toLocaleString("en-US")} />
          <Stat label="Branches" value={hub.branches.toLocaleString("en-US")} />
          <Stat
            label={`Cash reports filed (${monthLabel(month)})`}
            value={cash.value}
            tone={cash.tone}
          />
          <Stat label="Giving this month" value={money(hub.givingMinor)} />
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Pastor</th>
                <th className="px-4 py-3 text-right">Partners</th>
                <th className="px-4 py-3 text-right">Giving this month</th>
                <th className="px-4 py-3">Cash report</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr
                  key={b.churchId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-semibold">{b.name}</td>
                  <td className="px-4 py-3">{b.pastor || "Not on record"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {b.partners.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(b.givingMinor)}
                  </td>
                  <td
                    className={
                      "px-4 py-3 " +
                      (b.cashFiled ? "text-emerald-700" : "text-red-700")
                    }
                  >
                    {b.cashFiled ? `Filed, ${money(b.cashMinor)}` : "Not filed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {noBranchGivingMinor > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Also {money(noBranchGivingMinor)} this month from this hub&apos;s
            partners who have no branch yet.
          </p>
        )}
      </div>
    </div>
  );
}
