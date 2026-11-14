import Link from "next/link";
import { cookies } from "next/headers";
import { Banknote, Building2, HandCoins, Wallet } from "lucide-react";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import { getHubMonthlyInput, getHubSummary } from "@/lib/hub/db";
import {
  buildHubMonth,
  buildMonthTrail,
  monthsEndingAt,
  type ChurchMonthRow,
} from "@/lib/hub/monthly";
import { resolveMonth } from "@/lib/poc/admins-overview";

export const dynamic = "force-dynamic";

/** Months shown in the month-by-month table, ending at the chosen month. */
const TRAIL_MONTHS = 6;

const ghs = (minor: number) =>
  `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const dayLabel = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "";

const METHOD_LABELS = {
  mobile_money: "MoMo",
  bank: "Bank",
  paystack: "Paystack",
  other: "Other",
} as const;

/**
 * Hub Monthly summary (Decision 0038): for a chosen month, all giving and cash
 * giving, and which of the hub's churches have filed their cash report. Scoped
 * to the signed-in hub by the session.
 */
export default async function HubSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  const month = resolveMonth((await searchParams).month);
  const months = monthsEndingAt(month, TRAIL_MONTHS);
  const [summary, input] = session
    ? await Promise.all([
        getHubSummary(session.hubId),
        getHubMonthlyInput(session.hubId, months[0]),
      ])
    : [null, null];

  if (!session || !summary || !input) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load this hub. Sign out and back in, or contact the BENMP
        office.
      </p>
    );
  }

  const m = buildHubMonth(input, month);
  const trail = buildMonthTrail(input, months).reverse();
  const churches = m.filed.length + m.notFiled.length;
  const methods = (
    Object.keys(METHOD_LABELS) as (keyof typeof METHOD_LABELS)[]
  ).filter((k) => m.statementByMethod[k] > 0);

  const tiles = [
    {
      label: "All giving",
      value: ghs(m.totalMinor),
      note: "Statements and cash together",
      icon: HandCoins,
    },
    {
      label: "Statement giving",
      value: ghs(m.statementMinor),
      note:
        methods.length > 0
          ? methods
              .map((k) => `${METHOD_LABELS[k]} ${ghs(m.statementByMethod[k])}`)
              .join(" · ")
          : "No MoMo, bank or Paystack gifts recorded",
      icon: Wallet,
    },
    {
      label: "Cash giving",
      value: ghs(m.cashMinor),
      note: "From the churches' cash reports",
      icon: Banknote,
    },
    {
      label: "Cash reports filed",
      value: `${m.filed.length} of ${churches}`,
      note:
        m.notFiled.length === 0
          ? churches > 0
            ? "Every church has filed"
            : "No churches yet"
          : `${m.notFiled.length} still to file`,
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {monthLabel(month)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.hubLabel} · monthly summary
          </p>
        </div>
        {/* A plain GET form, so each month has its own link. */}
        <form action="/hub/summary" className="flex items-center gap-2">
          <label htmlFor="month" className="text-sm text-muted-foreground">
            Month
          </label>
          <input
            id="month"
            name="month"
            type="month"
            defaultValue={month}
            className="rounded border border-border bg-input px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Show
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, note, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>

      <ChurchTable
        title={`Cash report filed (${m.filed.length})`}
        rows={m.filed}
        filed
        empty="No church has filed a cash report for this month yet."
      />
      <ChurchTable
        title={`Not filed yet (${m.notFiled.length})`}
        rows={m.notFiled}
        filed={false}
        empty="Every church has filed its cash report for this month."
      />

      {m.noChurchMinor > 0 && (
        <p className="text-sm text-muted-foreground">
          Also {ghs(m.noChurchMinor)} of statement giving this month from
          partners with no church on record.
        </p>
      )}

      <section>
        <h2 className="mb-2 text-base font-bold text-foreground">
          Month by month
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm sm:min-w-[560px]">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">
                  Statements
                </th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">
                  Cash
                </th>
                <th className="px-4 py-3 text-right">All giving</th>
                <th className="px-4 py-3 text-right">Reports filed</th>
              </tr>
            </thead>
            <tbody>
              {trail.map((row) => (
                <tr
                  key={row.month}
                  className={
                    "border-b border-border last:border-0 " +
                    (row.month === month ? "bg-brand/5" : "")
                  }
                >
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      href={`/hub/summary?month=${row.month}`}
                      className="text-brand hover:underline"
                    >
                      {monthLabel(row.month)}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-right tabular-nums sm:table-cell">
                    {ghs(row.statementMinor)}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-right tabular-nums sm:table-cell">
                    {ghs(row.cashMinor)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-semibold tabular-nums">
                    {ghs(row.totalMinor)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">
                    {row.filed} of {row.churches}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Statement giving is MoMo, bank and Paystack gifts matched to your
        partners, by the month the money arrived. Cash is what each church
        reported on the cash form for the month.
      </p>
    </div>
  );
}

function ChurchTable({
  title,
  rows,
  filed,
  empty,
}: {
  title: string;
  rows: ChurchMonthRow[];
  filed: boolean;
  empty: string;
}) {
  return (
    <section>
      <h2
        className={
          "mb-2 text-base font-bold " +
          (filed ? "text-emerald-700" : "text-red-700")
        }
      >
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm sm:min-w-[560px]">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Church</th>
                <th className="hidden px-4 py-3 sm:table-cell">Pastor</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">
                  Partners
                </th>
                <th className="px-4 py-3 text-right">Statement giving</th>
                {filed && <th className="px-4 py-3 text-right">Cash</th>}
                {filed && <th className="px-4 py-3">Filed</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.churchId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {row.pastor || "Not on record"}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-right tabular-nums sm:table-cell">
                    {row.partners.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">
                    {ghs(row.statementMinor)}
                  </td>
                  {filed && (
                    <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">
                      {ghs(row.cashMinor)}
                    </td>
                  )}
                  {filed && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {dayLabel(row.filedAt)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
