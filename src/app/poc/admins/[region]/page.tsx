import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAdminsInput } from "@/lib/poc/admins-data";
import {
  ADMIN_BLOCKS,
  computeHubStats,
  hubsForRegion,
  resolveMonth,
} from "@/lib/poc/admins-overview";
import { METRICS, resolveMetric, totalsBy } from "@/lib/poc/admins-metrics";
import { AdminsSidebar, MetricsPanel, metricHref } from "../metrics";
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
  searchParams: Promise<{
    month?: string | string[];
    metric?: string | string[];
  }>;
}) {
  const code = (await params).region.toUpperCase();
  const query = await searchParams;
  const month = resolveMonth(query.month);
  const metric = resolveMetric(query.metric);
  const chosen = METRICS.find((m) => m.key === metric)!;
  const input = await loadAdminsInput(month);
  const region = input.regions.find((r) => r.code === code);
  if (!region) notFound();

  const label =
    ADMIN_BLOCKS.find((b) => b.regionCode === code)?.label ?? region.name;
  const hubs = hubsForRegion(input.hubs, computeHubStats(input), code);
  const base = `/poc/admins/${code.toLowerCase()}`;
  const forms = input.forms.filter((f) => f.region_id === region.id);
  const hubIds = new Set(hubs.map((h) => h.hubId));
  const byHub = totalsBy(forms, month, (r) => r.hub_id);

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 lg:pb-8">
      <div className="mx-auto max-w-6xl">
        <Crumbs month={month} trail={[{ label }]} />
        <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_13rem]">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{label}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hubs.length} {hubs.length === 1 ? "hub" : "hubs"},{" "}
                  {monthLabel(month)}. Open a hub to see its churches.
                </p>
              </div>
              <MonthPicker month={month} action={base} />
            </div>

            <MetricsPanel
              forms={forms}
              month={month}
              months={input.months}
              metric={metric}
              base={base}
              churches={
                input.churches.filter((c) => hubIds.has(c.hub_id)).length
              }
            />

            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Hub</th>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Last sign-in</th>
                    <th className="px-4 py-3 text-right">Forms submitted</th>
                    <th className="px-4 py-3 text-right text-foreground">
                      {chosen.label}
                    </th>
                    <th className="px-4 py-3 text-right">Giving reported</th>
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
                            href={metricHref(
                              `${base}/${h.hubId}`,
                              month,
                              metric,
                            )}
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
                            "px-4 py-3 " +
                            (h.adminSignedIn ? "" : "text-red-700")
                          }
                        >
                          {dateLabel(h.lastSignIn)}
                        </td>
                        <td
                          className={
                            "px-4 py-3 whitespace-nowrap text-right tabular-nums " +
                            (cash.tone === "warn"
                              ? "text-red-700"
                              : cash.tone === "good"
                                ? "text-emerald-700"
                                : "")
                          }
                        >
                          {cash.value}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {(byHub.get(h.hubId)?.[metric] ?? 0).toLocaleString(
                            "en-US",
                          )}
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
          <AdminsSidebar
            month={month}
            metric={metric}
            current={code}
            setUp={new Set(input.regions.map((r) => r.code))}
          />
        </div>
      </div>
    </div>
  );
}
