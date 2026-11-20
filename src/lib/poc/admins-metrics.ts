/**
 * The four Monthly Summary Form numbers on the office Admins tab (Decision
 * 0045): the landing page's big values, their month-by-month series, and the
 * same sums for each block, hub and church below it. Pure; the rows are the
 * churches' submitted forms (`cash_submissions`), loaded by ./admins-data.
 */

import { zeroCounts, type SummaryCounts } from "../hub/monthly";

export type MetricKey = keyof SummaryCounts;

export const METRICS: readonly { key: MetricKey; label: string }[] = [
  { key: "totalRegistered", label: "Total registered" },
  { key: "activePartners", label: "Active partners" },
  { key: "newRegistrations", label: "New registrations" },
  { key: "lapsed", label: "Lapsed" },
];

/** One submitted form, as the Admins tab reads it. */
export type FormRow = {
  church_id: string;
  hub_id: string;
  region_id: string;
  /** "YYYY-MM-01" */
  reporting_month: string;
  total_registered: number;
  active_partners: number;
  new_registrations: number;
  lapsed: number;
  /** The church's BENMP giving for the month (Decision 0043). */
  total_cash_minor: number;
  status: string;
};

export type FormTotals = SummaryCounts & {
  /** How many forms were added up. */
  forms: number;
  givingMinor: number;
};

/** "totalRegistered" etc. from a query value; total registered by default. */
export function resolveMetric(value: string | string[] | undefined): MetricKey {
  const v = Array.isArray(value) ? value[0] : value;
  return METRICS.find((m) => m.key === v)?.key ?? "totalRegistered";
}

export const formsInMonth = (rows: FormRow[], month: string) =>
  rows.filter((r) => r.reporting_month.slice(0, 7) === month);

export function sumForms(rows: FormRow[]): FormTotals {
  const totals: FormTotals = { ...zeroCounts(), forms: 0, givingMinor: 0 };
  for (const r of rows) {
    totals.totalRegistered += r.total_registered;
    totals.activePartners += r.active_partners;
    totals.newRegistrations += r.new_registrations;
    totals.lapsed += r.lapsed;
    totals.givingMinor += r.total_cash_minor;
    totals.forms += 1;
  }
  return totals;
}

/** The month's totals for each key (block region id, hub id, church id). */
export function totalsBy(
  rows: FormRow[],
  month: string,
  keyOf: (row: FormRow) => string,
): Map<string, FormTotals> {
  const groups = new Map<string, FormRow[]>();
  for (const r of formsInMonth(rows, month)) {
    const key = keyOf(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return new Map([...groups].map(([k, g]) => [k, sumForms(g)]));
}

/** One metric for each of `months` (oldest first), 0 where no form came in. */
export function metricSeries(
  rows: FormRow[],
  months: string[],
  metric: MetricKey,
): { month: string; value: number; forms: number }[] {
  return months.map((month) => {
    const t = sumForms(formsInMonth(rows, month));
    return { month, value: t[metric], forms: t.forms };
  });
}
