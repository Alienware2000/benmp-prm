import { notFound } from "next/navigation";
import { loadAdminsInput } from "@/lib/poc/admins-data";
import { METRICS, resolveMetric, totalsBy } from "@/lib/poc/admins-metrics";
import {
  ADMIN_BLOCKS,
  buildHubReport,
  resolveMonth,
} from "@/lib/poc/admins-overview";
import { AdminsSidebar, MetricsPanel, metricHref } from "../../metrics";
import {
  Crumbs,
  MonthPicker,
  dateLabel,
  usd,
  monthLabel,
  ofTotal,
} from "../../ui";

export const dynamic = "force-dynamic";

/**
 * One hub (Decisions 0036, 0045): its four numbers and chart, then each church
 * underneath with what it reported on the month's Monthly Summary Form.
 */
export default async function AdminsHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; hubId: string }>;
  searchParams: Promise<{
    month?: string | string[];
    metric?: string | string[];
  }>;
}) {
  const { region, hubId } = await params;
  const code = region.toUpperCase();
  const query = await searchParams;
  const month = resolveMonth(query.month);
  const metric = resolveMetric(query.metric);
  const input = await loadAdminsInput(month);
  const report = buildHubReport(input, hubId);
  if (!report || report.hub.regionCode !== code) notFound();

  const { hub, branches } = report;
  const regionName = input.regions.find((r) => r.code === code)?.name ?? code;
  const blockLabel =
    ADMIN_BLOCKS.find((b) => b.regionCode === code)?.label ?? regionName;
  const base = `/poc/admins/${code.toLowerCase()}/${hubId}`;
  const forms = input.forms.filter((f) => f.hub_id === hubId);
  const byChurch = totalsBy(forms, month, (r) => r.church_id);
  const filed = ofTotal(hub.cashFiled, hub.branches);

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 lg:pb-8">
      <div className="mx-auto max-w-6xl">
        <Crumbs
          month={month}
          trail={[
            {
              label: blockLabel,
              href: metricHref(
                `/poc/admins/${code.toLowerCase()}`,
                month,
                metric,
              ),
            },
            { label: hub.label },
          ]}
        />
        <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_13rem]">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {hub.label}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Admin: {hub.adminName || "no name on record"}. Last sign-in:{" "}
                  {dateLabel(hub.lastSignIn)}. Forms for {monthLabel(month)}:{" "}
                  <span
                    className={
                      filed.tone === "warn"
                        ? "text-red-700"
                        : filed.tone === "good"
                          ? "text-emerald-700"
                          : ""
                    }
                  >
                    {filed.value}
                  </span>
                  .
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
              churches={hub.branches}
            />

            <section>
              <h2 className="mb-2 text-base font-bold text-foreground">
                Churches
              </h2>
              <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Church</th>
                      <th className="px-4 py-3">Form</th>
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
                    {branches.map((b) => {
                      const t = byChurch.get(b.churchId);
                      return (
                        <tr
                          key={b.churchId}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-3">
                            <span className="font-semibold">{b.name}</span>
                            {b.pastor && (
                              <span className="block text-xs text-muted-foreground">
                                {b.pastor}
                              </span>
                            )}
                          </td>
                          <td
                            className={
                              "px-4 py-3 whitespace-nowrap " +
                              (t ? "text-emerald-700" : "text-red-700")
                            }
                          >
                            {t ? "Submitted" : "Not submitted"}
                          </td>
                          {METRICS.map((m) => (
                            <td
                              key={m.key}
                              className={
                                "px-4 py-3 text-right tabular-nums " +
                                (m.key === metric ? "font-semibold" : "")
                              }
                            >
                              {t ? t[m.key].toLocaleString("en-US") : ""}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right tabular-nums">
                            {t ? usd(t.givenUsdCents) : ""}
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
            current={code}
            setUp={new Set(input.regions.map((r) => r.code))}
          />
        </div>
      </div>
    </div>
  );
}
