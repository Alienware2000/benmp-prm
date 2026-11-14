// src/lib/hub/monthly.ts
// A hub admin's month (Decision 0038, /hub/summary): all giving, cash giving,
// and which of the hub's churches have filed their cash report. Pure; the page
// loads the hub's own churches, partners, matched payments and cash reports.
//
// Two sources, never double-counted:
// - Statement giving (MoMo, bank, Paystack) comes from payments matched to the
//   hub's partners, by the month the money arrived.
// - Cash comes from the churches' cash reports for that reporting month, whether
//   or not the office has promoted them into the ledger yet. Ledger rows in the
//   cash group are therefore left out of statement giving.
import {
  toPaymentMethodGroup,
  type PaymentMethodGroup,
} from "../poc/dashboard-metrics";

export type HubMonthlyInput = {
  churches: { id: string; name: string; leader_name: string | null }[];
  partners: { id: string; church_id: string | null }[];
  payments: {
    partner_id: string;
    paid_at: string;
    amount_minor: number;
    payment_method: string | null;
    raw_method: string | null;
    /** raw_row.source; the only method hint on older MoMo/Ecobank imports. */
    raw_source: string | null;
  }[];
  cashReports: {
    church_id: string;
    /** "YYYY-MM-01" */
    reporting_month: string;
    total_cash_minor: number;
    submitted_at: string | null;
  }[];
};

export type StatementMethod = Exclude<PaymentMethodGroup, "cash">;

export type ChurchMonthRow = {
  churchId: string;
  name: string;
  pastor: string;
  partners: number;
  statementMinor: number;
  cashMinor: number;
  filedAt: string | null;
};

export type HubMonth = {
  month: string;
  statementByMethod: Record<StatementMethod, number>;
  statementMinor: number;
  cashMinor: number;
  totalMinor: number;
  /** Distinct partners with a statement gift this month. */
  givers: number;
  filed: ChurchMonthRow[];
  notFiled: ChurchMonthRow[];
  /** Statement giving from the hub's partners who have no church yet. */
  noChurchMinor: number;
};

export type MonthTrailRow = {
  month: string;
  statementMinor: number;
  cashMinor: number;
  totalMinor: number;
  filed: number;
  churches: number;
};

const emptyMethods = (): Record<StatementMethod, number> => ({
  mobile_money: 0,
  bank: 0,
  paystack: 0,
  other: 0,
});

export function buildHubMonth(input: HubMonthlyInput, month: string): HubMonth {
  const churchOf = new Map(input.partners.map((p) => [p.id, p.church_id]));
  const partnersByChurch = new Map<string, number>();
  for (const p of input.partners) {
    if (p.church_id)
      partnersByChurch.set(
        p.church_id,
        (partnersByChurch.get(p.church_id) ?? 0) + 1,
      );
  }

  const statementByMethod = emptyMethods();
  const statementByChurch = new Map<string, number>();
  const givers = new Set<string>();
  let noChurchMinor = 0;
  for (const payment of input.payments) {
    if (payment.paid_at.slice(0, 7) !== month) continue;
    const group = toPaymentMethodGroup(payment.payment_method, {
      _payment_method: payment.raw_method,
      source: payment.raw_source,
    });
    if (group === "cash") continue;
    statementByMethod[group] += payment.amount_minor;
    givers.add(payment.partner_id);
    const churchId = churchOf.get(payment.partner_id);
    if (churchId)
      statementByChurch.set(
        churchId,
        (statementByChurch.get(churchId) ?? 0) + payment.amount_minor,
      );
    else noChurchMinor += payment.amount_minor;
  }

  const reports = new Map(
    input.cashReports
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
      partners: partnersByChurch.get(church.id) ?? 0,
      statementMinor: statementByChurch.get(church.id) ?? 0,
      cashMinor: report?.total_cash_minor ?? 0,
      filedAt: report?.submitted_at ?? null,
    };
    (report ? filed : notFiled).push(row);
  }

  const statementMinor = Object.values(statementByMethod).reduce(
    (a, b) => a + b,
    0,
  );
  const cashMinor = filed.reduce((sum, row) => sum + row.cashMinor, 0);
  return {
    month,
    statementByMethod,
    statementMinor,
    cashMinor,
    totalMinor: statementMinor + cashMinor,
    givers: givers.size,
    filed,
    notFiled,
    noChurchMinor,
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
      statementMinor: m.statementMinor,
      cashMinor: m.cashMinor,
      totalMinor: m.totalMinor,
      filed: m.filed.length,
      churches: m.filed.length + m.notFiled.length,
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
