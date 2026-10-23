import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAdminsInput } from "@/lib/poc/admins-data";
import {
  ADMIN_BLOCKS,
  computeHubStats,
  hubsForRegion,
  resolveMonth,
} from "@/lib/poc/admins-overview";
import {
  Crumbs,
  MonthPicker,
  dateLabel,
  money,
  monthLabel,
  ofTotal,
} from "../ui";

export const dynamic = "force-dynamic";

export default async function AdminsRegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const code = (await params).region.toUpperCase();
  const month = resolveMonth((await searchParams).month);
  const input = await loadAdminsInput(month);
  const region = input.regions.find((r) => r.code === code);
  if (!region) notFound();

  const label =
    ADMIN_BLOCKS.find((b) => b.regionCode === code)?.label ?? region.name;
  const hubs = hubsForRegion(input.hubs, computeHubStats(input, month), code);
  const base = `/poc/admins/${code.toLowerCase()}`;

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 lg:pb-8">
      <div className="mx-auto max-w-6xl">
        <Crumbs month={month} trail={[{ label }]} />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{label}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {hubs.length} {hubs.length === 1 ? "hub" : "hubs"},{" "}
              {monthLabel(month)}. Open a hub to see its branches.
            </p>
          </div>
          <MonthPicker month={month} action={base} />
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Hub</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3 text-right">Partners</th>
                <th className="px-4 py-3 text-right">Cash reports filed</th>
                <th className="px-4 py-3 text-right">Giving this month</th>
              </tr>
            </thead>
            <tbody>
              {hubs.map((h) => {
                const cash = ofTotal(h.cashFiled, h.branches);
                return (
                  <tr
                    key={h.hubId}
                    className="border-b border-border last:border-0 hover:bg-background"
                  >
                    <td className="px-4 py-3 font-semibold">
                      <Link
                        href={`${base}/${h.hubId}?month=${month}`}
                        className="text-brand hover:underline"
                      >
                        {h.label}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {h.adminName || "No name on record"}
                    </td>
                    <td
                      className={
                        "px-4 py-3 " + (h.adminSignedIn ? "" : "text-red-700")
                      }
                    >
                      {dateLabel(h.lastSignIn)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.partners.toLocaleString("en-US")}
                    </td>
                    <td
                      className={
                        "px-4 py-3 text-right tabular-nums " +
                        (cash.tone === "warn"
                          ? "text-red-700"
                          : cash.tone === "good"
                            ? "text-emerald-700"
                            : "")
                      }
                    >
                      {cash.value}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {money(h.givingMinor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
