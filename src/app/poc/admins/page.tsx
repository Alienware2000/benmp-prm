import Link from "next/link";
import { loadAdminsInput } from "@/lib/poc/admins-data";
import { METRICS, resolveMetric, totalsBy } from "@/lib/poc/admins-metrics";
import {
  buildBlocks,
  computeHubStats,
  resolveMonth,
} from "@/lib/poc/admins-overview";
import { AdminsSidebar, MetricsPanel, metricHref } from "./metrics";
import { MonthPicker, money, monthLabel, ofTotal } from "./ui";

export const dynamic = "force-dynamic";

/**
 * Office Admins landing page (Decisions 0036, 0045): the four Monthly Summary
 * Form numbers across every quadrant, the chosen one charted month by month,
 * then each quadrant to drill into (quadrant -> hub -> church).
 */
export default async function AdminsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string | string[];
    metric?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const month = resolveMonth(query.month);
  const metric = resolveMetric(query.metric);
  const input = await loadAdminsInput(month);
  const blocks = buildBlocks(input.regions, computeHubStats(input));
  const regionId = new Map(input.regions.map((r) => [r.code, r.id]));
  const byRegion = totalsBy(input.forms, month, (r) => r.region_id);

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 lg:pb-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admins</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every church&apos;s Monthly Summary Form for {monthLabel(month)},
              across all quadrants.
            </p>
          </div>
          <MonthPicker month={month} action="/poc/admins" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_13rem]">
          <div className="min-w-0 space-y-6">
            <MetricsPanel
              forms={input.forms}
              month={month}
              months={input.months}
              metric={metric}
              base="/poc/admins"
              churches={input.churches.length}
            />

            <section>
              <h2 className="mb-2 text-base font-bold text-foreground">
                By quadrant
              </h2>
              <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Quadrant</th>
                      <th className="px-4 py-3 text-right">Hubs</th>
                      <th className="px-4 py-3 text-right">Forms</th>
                      {METRICS.map((m) => (
                        <th
                          key={m.key}
                          className={
                            "px-4 py-3 text-right " +
                            (m.key === metric ? "text-foreground" : "")
                          }
                        >
                          {m.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right">Giving reported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((b) => {
                      const id = b.regionCode
                        ? regionId.get(b.regionCode)
                        : undefined;
                      const t = id ? byRegion.get(id) : undefined;
                      const forms = ofTotal(b.cashFiled, b.branches);
                      const open = b.setUp && b.hubs > 0;
                      return (
                        <tr
                          key={b.label}
                          className={
                            "border-b border-border last:border-0 " +
                            (open ? "" : "text-muted-foreground")
                          }
                        >
                          <td className="px-4 py-3 font-semibold">
                            {open ? (
                              <Link
                                href={metricHref(
                                  `/poc/admins/${b.regionCode!.toLowerCase()}`,
                                  month,
                                  metric,
                                )}
                                className="text-brand hover:underline"
                              >
                                {b.label}
                              </Link>
                            ) : (
                              <>
                                {b.label}{" "}
                                <span className="text-xs font-normal">
                                  (not set up)
                                </span>
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {b.hubs}
                          </td>
                          <td
                            className={
                              "px-4 py-3 whitespace-nowrap text-right tabular-nums " +
                              (forms.tone === "warn"
                                ? "text-red-700"
                                : forms.tone === "good"
                                  ? "text-emerald-700"
                                  : "")
                            }
                          >
                            {forms.value}
                          </td>
                          {METRICS.map((m) => (
                            <td
                              key={m.key}
                              className={
                                "px-4 py-3 text-right tabular-nums " +
                                (m.key === metric ? "font-semibold" : "")
                              }
                            >
                              {(t?.[m.key] ?? 0).toLocaleString("en-US")}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right tabular-nums">
                            {money(t?.givingMinor ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <AdminsSidebar
            month={month}
            metric={metric}
            setUp={new Set(input.regions.map((r) => r.code))}
          />
        </div>
      </div>
    </div>
  );
}
