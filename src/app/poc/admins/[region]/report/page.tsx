import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAdminsInput } from "@/lib/poc/admins-data";
import {
  METRICS,
  formsInMonth,
  monthlyTotals,
  sumForms,
  totalsBy,
} from "@/lib/poc/admins-metrics";
import {
  ADMIN_BLOCKS,
  buildHubReport,
  computeHubStats,
  hubsForRegion,
  resolveMonth,
} from "@/lib/poc/admins-overview";
import {
  ColumnChart,
  GroupedColumnChart,
  SERIES,
  usdShort,
} from "../../metrics";
import { dateLabel, monthLabel } from "../../ui";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const count = (n: number) => n.toLocaleString("en-US");

/**
 * A quadrant's report for its bishop (Decision 0049): one month's four numbers
 * and giving, the 12-month charts, every hub, and (optionally) every church.
 * Laid out for A4; "Download PDF" prints it, where Save as PDF makes the file.
 */
export default async function QuadrantReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<{
    month?: string | string[];
    churches?: string | string[];
  }>;
}) {
  const code = (await params).region.toUpperCase();
  const query = await searchParams;
  const month = resolveMonth(query.month);
  const withChurches = query.churches === "1";
  const input = await loadAdminsInput(month);
  const region = input.regions.find((r) => r.code === code);
  if (!region) notFound();

  const label =
    ADMIN_BLOCKS.find((b) => b.regionCode === code)?.label ?? region.name;
  const hubs = hubsForRegion(input.hubs, computeHubStats(input), code);
  const hubIds = new Set(hubs.map((h) => h.hubId));
  const forms = input.forms.filter((f) => f.region_id === region.id);
  const totals = sumForms(formsInMonth(forms, month));
  const churches = input.churches.filter((c) => hubIds.has(c.hub_id)).length;
  const byHub = totalsBy(forms, month, (r) => r.hub_id);
  const byChurch = totalsBy(forms, month, (r) => r.church_id);
  const byMonth = monthlyTotals(forms, input.months);
  const base = `/poc/admins/${code.toLowerCase()}`;
  const toggleHref = `${base}/report?month=${month}${withChurches ? "" : "&churches=1"}`;

  return (
    <div className="report min-h-screen bg-background print:min-h-0 px-4 py-8 print:bg-white print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        @media print {
          html, body { background: #fff !important; }
          .report section { break-inside: avoid; }
          .report .hub-block { break-inside: avoid-page; }
          .report a { color: inherit; text-decoration: none; }
        }
      `}</style>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={`${base}?month=${month}`}
            className="text-sm text-brand hover:underline"
          >
            Back to {label}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <form
              action={`${base}/report`}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="hidden"
                name="churches"
                value={withChurches ? "1" : ""}
              />
              <label htmlFor="month" className="text-muted-foreground">
                Month
              </label>
              <input
                id="month"
                name="month"
                type="month"
                defaultValue={month}
                className="rounded border border-border bg-input px-2 py-1"
              />
              <button
                type="submit"
                className="rounded border border-border px-3 py-1"
              >
                Show
              </button>
            </form>
            <Link
              href={toggleHref}
              className="text-sm text-brand hover:underline"
            >
              {withChurches ? "Hubs only" : "Add every church"}
            </Link>
            <PrintButton />
          </div>
        </div>

        <header className="border-b-2 border-foreground pb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            BENMP · Quadrant report
          </p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">
            {label}, {monthLabel(month)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hubs.length} hubs · {count(churches)} churches ·{" "}
            {count(totals.forms)} Monthly Summary{" "}
            {totals.forms === 1 ? "Form" : "Forms"} submitted · prepared{" "}
            {dateLabel(new Date().toISOString())}
          </p>
        </header>

        <section className="grid grid-cols-5 gap-2">
          {METRICS.map(({ key, label: l }) => (
            <div key={key} className="rounded border border-border p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: SERIES[key] }}
                />
                {l}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {count(totals[key])}
              </p>
            </div>
          ))}
          <div className="rounded border border-border p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">
              Given (USD)
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {usdShort(totals.givenUsdCents)}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold">Members, last 12 months</h2>
          <ul className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            {METRICS.map(({ key, label: l }) => (
              <li key={key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: SERIES[key] }}
                />
                {l}
              </li>
            ))}
          </ul>
          <GroupedColumnChart
            data={byMonth}
            selected={month}
            hrefFor={(m) => `${base}/report?month=${m}`}
          />
        </section>

        <section>
          <h2 className="text-base font-bold">
            Amount given, last 12 months (USD)
          </h2>
          <ColumnChart
            data={byMonth.map((m) => ({
              month: m.month,
              value: m.givenUsdCents,
              forms: m.forms,
            }))}
            selected={month}
            label="Amount given (USD)"
            format={usdShort}
            hrefFor={(m) => `${base}/report?month=${m}`}
          />
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">
            Hubs, {monthLabel(month)}
          </h2>
          <table className="w-full text-xs">
            <thead className="border-b border-foreground text-left">
              <tr>
                <th className="py-1.5 pr-2">Hub</th>
                <th className="py-1.5 pr-2">Admin</th>
                <th className="py-1.5 pr-2 text-right">Forms</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="py-1.5 pr-2 text-right">
                    {m.label}
                  </th>
                ))}
                <th className="py-1.5 text-right">Given</th>
              </tr>
            </thead>
            <tbody>
              {hubs.map((h) => {
                const t = byHub.get(h.hubId);
                return (
                  <tr key={h.hubId} className="border-b border-border">
                    <td className="py-1.5 pr-2 font-semibold">{h.label}</td>
                    <td className="py-1.5 pr-2">
                      {h.adminName || "Not on record"}
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap text-right tabular-nums">
                      {h.cashFiled} of {h.branches}
                    </td>
                    {METRICS.map((m) => (
                      <td
                        key={m.key}
                        className="py-1.5 pr-2 text-right tabular-nums"
                      >
                        {count(t?.[m.key] ?? 0)}
                      </td>
                    ))}
                    <td className="py-1.5 text-right tabular-nums">
                      {usdShort(t?.givenUsdCents ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-foreground font-semibold">
              <tr>
                <td className="py-1.5 pr-2" colSpan={2}>
                  Quadrant total
                </td>
                <td className="py-1.5 pr-2 whitespace-nowrap text-right tabular-nums">
                  {count(totals.forms)} of {count(churches)}
                </td>
                {METRICS.map((m) => (
                  <td
                    key={m.key}
                    className="py-1.5 pr-2 text-right tabular-nums"
                  >
                    {count(totals[m.key])}
                  </td>
                ))}
                <td className="py-1.5 text-right tabular-nums">
                  {usdShort(totals.givenUsdCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {withChurches &&
          hubs.map((h) => {
            const report = buildHubReport(input, h.hubId);
            if (!report) return null;
            return (
              <section key={h.hubId} className="hub-block">
                <h2 className="mb-1 text-sm font-bold">{h.label}: churches</h2>
                <table className="w-full text-xs">
                  <thead className="border-b border-foreground text-left">
                    <tr>
                      <th className="py-1 pr-2">Church</th>
                      <th className="py-1 pr-2">Pastor</th>
                      <th className="py-1 pr-2">Form</th>
                      {METRICS.map((m) => (
                        <th key={m.key} className="py-1 pr-2 text-right">
                          {m.label}
                        </th>
                      ))}
                      <th className="py-1 text-right">Given</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.branches.map((b) => {
                      const t = byChurch.get(b.churchId);
                      return (
                        <tr key={b.churchId} className="border-b border-border">
                          <td className="py-1 pr-2">{b.name}</td>
                          <td className="py-1 pr-2">{b.pastor}</td>
                          <td
                            className={
                              "py-1 pr-2 whitespace-nowrap " +
                              (t ? "text-emerald-700" : "text-red-700")
                            }
                          >
                            {t ? "Submitted" : "Not submitted"}
                          </td>
                          {METRICS.map((m) => (
                            <td
                              key={m.key}
                              className="py-1 pr-2 text-right tabular-nums"
                            >
                              {t ? count(t[m.key]) : ""}
                            </td>
                          ))}
                          <td className="py-1 text-right tabular-nums">
                            {t ? usdShort(t.givenUsdCents) : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}

        <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
          Every figure is what the churches reported on the Monthly Summary Form
          for the month. Amounts given are US-dollar equivalents.
        </p>
      </div>
    </div>
  );
}
