// src/lib/hub/church-members.ts
// One church, member by member, month by month (Decision 0040): the drill-down
// below a hub (office Admins tab and the hub's own Monthly summary). Pure; the
// pages load the church, its partners, the payments matched to them and the
// church's Monthly Summary Forms.
//
// Per-member figures are statement giving (MoMo, bank, Paystack) matched to the
// member. Cash on the form is reported for the church as a whole, not per
// member, so it is a separate church-level line; ledger rows in the cash group
// are left out of the members' figures, as on the Monthly summary.
import { toPaymentMethodGroup } from "../poc/dashboard-metrics";
import type { SummaryCounts } from "./monthly";

export type ChurchMemberInput = {
  church: {
    id: string;
    name: string;
    leader_name: string | null;
    hub_id: string;
  };
  partners: {
    id: string;
    full_name: string;
    momo_phone_number: string | null;
    whatsapp_number: string | null;
  }[];
  payments: {
    partner_id: string;
    paid_at: string;
    amount_minor: number;
    payment_method: string | null;
    raw_method: string | null;
    raw_source: string | null;
  }[];
  forms: (SummaryFormRow & { reporting_month: string })[];
};

type SummaryFormRow = {
  total_cash_minor: number;
  submitted_at: string | null;
  total_registered: number;
  active_partners: number;
  new_registrations: number;
  lapsed: number;
};

export type MemberMonths = {
  id: string;
  name: string;
  phone: string | null;
  /** Statement giving per "YYYY-MM"; months with nothing are 0. */
  byMonth: Record<string, number>;
  totalMinor: number;
  /** Most recent gift inside the window, or null. */
  lastGiftAt: string | null;
};

export type ChurchMonthForm = {
  submittedAt: string | null;
  cashMinor: number;
  counts: SummaryCounts;
};

export type ChurchMemberView = {
  months: string[];
  /** Givers first (largest total), then everyone else by name. */
  members: MemberMonths[];
  /** Statement giving per month across all members. */
  monthTotals: Record<string, number>;
  /** Members who gave in each month. */
  giversByMonth: Record<string, number>;
  /** The church's form per month; null when it did not submit. */
  formByMonth: Record<string, ChurchMonthForm | null>;
  totalMinor: number;
  /** Members with at least one gift in the window. */
  givingMembers: number;
};

export function buildChurchMemberView(
  input: ChurchMemberInput,
  months: string[],
): ChurchMemberView {
  const window = new Set(months);
  const zeroes = () => Object.fromEntries(months.map((m) => [m, 0]));
  const members = new Map<string, MemberMonths>(
    input.partners.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.full_name,
        phone: p.whatsapp_number || p.momo_phone_number || null,
        byMonth: zeroes(),
        totalMinor: 0,
        lastGiftAt: null,
      },
    ]),
  );
  const monthTotals: Record<string, number> = zeroes();
  const givers = new Map(months.map((m) => [m, new Set<string>()]));

  for (const payment of input.payments) {
    const month = payment.paid_at.slice(0, 7);
    const member = members.get(payment.partner_id);
    if (!member || !window.has(month)) continue;
    const group = toPaymentMethodGroup(payment.payment_method, {
      _payment_method: payment.raw_method,
      source: payment.raw_source,
    });
    if (group === "cash") continue;
    member.byMonth[month] += payment.amount_minor;
    member.totalMinor += payment.amount_minor;
    if (!member.lastGiftAt || payment.paid_at > member.lastGiftAt)
      member.lastGiftAt = payment.paid_at;
    monthTotals[month] += payment.amount_minor;
    givers.get(month)!.add(member.id);
  }

  const formByMonth: Record<string, ChurchMonthForm | null> =
    Object.fromEntries(months.map((m) => [m, null]));
  for (const form of input.forms) {
    const month = form.reporting_month.slice(0, 7);
    if (!window.has(month)) continue;
    formByMonth[month] = {
      submittedAt: form.submitted_at,
      cashMinor: form.total_cash_minor,
      counts: {
        totalRegistered: form.total_registered,
        activePartners: form.active_partners,
        newRegistrations: form.new_registrations,
        lapsed: form.lapsed,
      },
    };
  }

  const sorted = [...members.values()].sort(
    (a, b) => b.totalMinor - a.totalMinor || a.name.localeCompare(b.name),
  );
  return {
    months,
    members: sorted,
    monthTotals,
    giversByMonth: Object.fromEntries(
      months.map((m) => [m, givers.get(m)!.size]),
    ),
    formByMonth,
    totalMinor: sorted.reduce((sum, m) => sum + m.totalMinor, 0),
    givingMembers: sorted.filter((m) => m.totalMinor > 0).length,
  };
}
