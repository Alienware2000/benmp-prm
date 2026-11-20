import Link from "next/link";
import { ClipboardList, ExternalLink } from "lucide-react";
import {
  METRICS,
  formsInMonth,
  metricSeries,
  sumForms,
  type FormRow,
  type MetricKey,
} from "@/lib/poc/admins-metrics";
import { ADMIN_BLOCKS } from "@/lib/poc/admins-overview";
import { monthLabel } from "./ui";

const count = (n: number) => n.toLocaleString("en-US");
const shortMonth = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });

/** `base?month=…&metric=…` */
export const metricHref = (base: string, month: string, metric: MetricKey) =>
  `${base}?month=${month}&metric=${metric}`;

/**
 * The four Monthly Summary Form numbers as big values (Decision 0045), each a
 * link that charts it, and the chart of the chosen one month by month. `forms`
 * is already scoped to the page (all, one block, one hub).
 */
export function MetricsPanel({
  forms,
  month,
  months,
  metric,
  base,
  churches,
}: {
  forms: FormRow[];
  month: string;
  months: string[];
  metric: MetricKey;
  base: string;
  /** Churches in scope, for "from N of M churches". */
  churches: number;
}) {
  const totals = sumForms(formsInMonth(forms, month));
  const chosen = METRICS.find((m) => m.key === metric)!;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICS.map(({ key, label }) => {
          const active = key === metric;
          return (
            <Link
              key={key}
              href={metricHref(base, month, key)}
              aria-current={active ? "true" : undefined}
              className={
                "rounded-lg border bg-surface p-4 shadow-sm transition hover:border-brand " +
                (active ? "border-brand ring-2 ring-brand/30" : "border-border")
              }
            >
              <p className="text-xs font-semibold text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {count(totals[key])}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {active ? "Charted below" : "Click to chart"}
              </p>
            </Link>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {`${monthLabel(month)}: added up from ${count(totals.forms)} of ${count(churches)} churches' Monthly Summary Forms.`}
      </p>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-base font-bold text-foreground">
          {chosen.label}, month by month
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The sum of the forms submitted each month. Click a month to open it.
        </p>
        <ColumnChart
          data={metricSeries(forms, months, metric)}
          selected={month}
          label={chosen.label}
          hrefFor={(m) => metricHref(base, m, metric)}
        />
      </section>
    </div>
  );
}

/** Server-rendered single-series column chart with a hover tooltip per month. */
function ColumnChart({
  data,
  selected,
  label,
  hrefFor,
}: {
  data: { month: string; value: number; forms: number }[];
  selected: string;
  label: string;
  hrefFor: (month: string) => string;
}) {
  const W = 720;
  const H = 220;
  const top = 24;
  const bottom = 28;
  const left = 44;
  const plotH = H - top - bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const band = (W - left) / data.length;
  const barW = Math.min(36, band * 0.6);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <div className="mt-3 overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[560px]"
        role="img"
        aria-label={`${label} by month: ${data.map((d) => `${monthLabel(d.month)} ${count(d.value)}`).join(", ")}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={W}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={left - 6}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {count(Math.round(t))}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = left + band * i + band / 2;
          const h = (d.value / max) * plotH;
          const isSel = d.month === selected;
          const tipW = 132;
          const tipX = Math.min(Math.max(cx - tipW / 2, left), W - tipW);
          return (
            <a key={d.month} href={hrefFor(d.month)} className="group">
              <title>{`${monthLabel(d.month)}: ${count(d.value)} (${d.forms} forms)`}</title>
              {/* Hit target: the whole column, taller than the bar. */}
              <rect
                x={left + band * i}
                y={top}
                width={band}
                height={plotH}
                fill="transparent"
              />
              {h > 0 && (
                <path
                  d={roundedTop(cx - barW / 2, y(d.value), barW, h, 4)}
                  className={
                    "fill-brand transition-opacity group-hover:opacity-80 " +
                    (isSel ? "" : "opacity-60")
                  }
                />
              )}
              <text
                x={cx}
                y={H - 10}
                textAnchor="middle"
                className={
                  "text-[11px] " +
                  (isSel
                    ? "fill-foreground font-semibold"
                    : "fill-muted-foreground")
                }
              >
                {shortMonth(d.month)}
              </text>
              {isSel && (
                <text
                  x={cx}
                  y={y(d.value) - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[12px] font-semibold"
                >
                  {count(d.value)}
                </text>
              )}
              <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
                <rect
                  x={tipX}
                  y={2}
                  width={tipW}
                  height={20}
                  rx={4}
                  className="fill-foreground"
                />
                <text
                  x={tipX + tipW / 2}
                  y={16}
                  textAnchor="middle"
                  className="fill-background text-[11px] font-semibold"
                >
                  {`${shortMonth(d.month)}: ${count(d.value)} · ${d.forms} forms`}
                </text>
              </g>
            </a>
          );
        })}
      </svg>
    </div>
  );
}

/** A bar anchored to the baseline with only its top corners rounded. */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** A round axis maximum: 1, 2 or 5 × a power of ten, at least the data max. */
function niceMax(v: number): number {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((n) => n >= v) ?? 10 * p;
}

/**
 * Side panel: a button per quadrant (the office's blocks) and the Monthly
 * Summary Form as a button (Decision 0045).
 */
export function AdminsSidebar({
  month,
  metric,
  current,
  setUp,
}: {
  month: string;
  metric: MetricKey;
  /** regions.code of the block being viewed, if any. */
  current?: string;
  /** Region codes that exist. */
  setUp: Set<string>;
}) {
  return (
    <aside className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
        <h2 className="px-1 text-xs font-semibold uppercase text-muted-foreground">
          Quadrants
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          <Link
            href={metricHref("/poc/admins", month, metric)}
            className={sideButton(!current)}
          >
            All quadrants
          </Link>
          {ADMIN_BLOCKS.map(({ label, regionCode }) =>
            regionCode && setUp.has(regionCode) ? (
              <Link
                key={label}
                href={metricHref(
                  `/poc/admins/${regionCode.toLowerCase()}`,
                  month,
                  metric,
                )}
                className={sideButton(current === regionCode)}
              >
                {label}
              </Link>
            ) : (
              <span
                key={label}
                className="rounded border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
                title="No hubs yet"
              >
                {label}
              </span>
            ),
          )}
        </div>
      </div>
      <div className="space-y-1.5 rounded-lg border border-border bg-surface p-3 shadow-sm">
        <a
          href="/cash"
          target="_blank"
          rel="noopener"
          className="flex items-center justify-center gap-1.5 rounded bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Monthly Summary Form
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
        <Link
          href="/poc/cash/monitoring"
          className="flex items-center justify-center gap-1.5 rounded border border-border px-3 py-2 text-sm font-semibold text-foreground hover:border-brand"
        >
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          Filed forms
        </Link>
      </div>
    </aside>
  );
}

const sideButton = (active: boolean) =>
  "rounded border px-3 py-1.5 text-sm font-semibold " +
  (active
    ? "border-brand bg-brand text-white"
    : "border-border text-foreground hover:border-brand");
