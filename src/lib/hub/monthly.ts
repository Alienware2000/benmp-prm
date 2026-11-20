// src/lib/hub/monthly.ts
// A hub's month (Decisions 0038, 0039, 0044; /hub/summary): which of its
// churches have submitted the Monthly Summary Form, the sums of the form's four
// numbers, and the BENMP giving the churches reported on it. Pure; the page
// loads the hub's churches and their submitted forms.
//
// Hub giving tracking is its own system (Decision 0044): every figure here comes
// from the forms. Statement giving (MoMo, bank statement and Paystack tracking) and registered partners (hub
// registrations) are not mixed in.

export type HubMonthlyInput = {
  churches: { id: string; name: string; leader_name: string | null }[];
  /** Monthly Summary Forms (`cash_submissions`), one per church per month. */
  reports: {
    church_id: string;
    /** "YYYY-MM-01" */
    reporting_month: string;
    /** The church's total BENMP giving for the month (Decision 0043). */
    total_cash_minor: number;
    submitted_at: string | null;
    total_registered: number;
    active_partners: number;
    new_registrations: number;
    lapsed: number;
  }[];
};

/** The four numbers every church reports on the Monthly Summary Form. */
export type SummaryCounts = {
  totalRegistered: number;
  activePartners: number;
  newRegistrations: number;
  lapsed: number;
};

export const zeroCounts = (): SummaryCounts => ({
  totalRegistered: 0,
  activePartners: 0,
  newRegistrations: 0,
  lapsed: 0,
});

export type ChurchMonthRow = {
  churchId: string;
  name: string;
  pastor: string;
  /** Giving the church reported; 0 when it has not submitted. */
  givingMinor: number;
  filedAt: string | null;
  /** The church's four numbers; null when it has not submitted this month. */
  counts: SummaryCounts | null;
};

export type HubMonth = {
  month: string;
  /** Giving reported on the month's forms. */
  givingMinor: number;
  /** Churches that submitted the form this month, and those that have not. */
  filed: ChurchMonthRow[];
  notFiled: ChurchMonthRow[];
  /** The four numbers added up across the churches that submitted. */
  summaryTotals: SummaryCounts;
};

export type MonthTrailRow = {
  month: string;
  givingMinor: number;
  filed: number;
  churches: number;
  summaryTotals: SummaryCounts;
};

export function buildHubMonth(input: HubMonthlyInput, month: string): HubMonth {
  const reports = new Map(
    input.reports
      .filter((r) => r.reporting_month.slice(0, 7) === month)
      .map((r) => [r.church_id, r]),
  );
  const filed: ChurchMonthRow[] = [];
  const notFiled: ChurchMonthRow[] = [];
  for (const church of [...input.churches].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const report = reports.get(church.id);
    const row: ChurchMonthRow = {
      churchId: church.id,
      name: church.name,
      pastor: church.leader_name ?? "",
      givingMinor: report?.total_cash_minor ?? 0,
      filedAt: report?.submitted_at ?? null,
      counts: report
        ? {
            totalRegistered: report.total_registered,
            activePartners: report.active_partners,
            newRegistrations: report.new_registrations,
            lapsed: report.lapsed,
          }
        : null,
    };
    (report ? filed : notFiled).push(row);
  }

  const summaryTotals = zeroCounts();
  for (const row of filed) {
    for (const key of Object.keys(summaryTotals) as (keyof SummaryCounts)[]) {
      summaryTotals[key] += row.counts?.[key] ?? 0;
    }
  }
  return {
    month,
    givingMinor: filed.reduce((sum, row) => sum + row.givingMinor, 0),
    filed,
    notFiled,
    summaryTotals,
  };
}

/** One row per month, oldest first, for the month-by-month table. */
export function buildMonthTrail(
  input: HubMonthlyInput,
  months: string[],
): MonthTrailRow[] {
  return [...months].sort().map((month) => {
    const m = buildHubMonth(input, month);
    return {
      month,
      givingMinor: m.givingMinor,
      filed: m.filed.length,
      churches: m.filed.length + m.notFiled.length,
      summaryTotals: m.summaryTotals,
    };
  });
}

/** `month` and the `count - 1` months before it, oldest first ("YYYY-MM"). */
export function monthsEndingAt(month: string, count: number): string[] {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}
