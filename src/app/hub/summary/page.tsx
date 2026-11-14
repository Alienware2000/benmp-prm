import Link from "next/link";
import { cookies } from "next/headers";
import { Banknote, Building2, HandCoins, Wallet } from "lucide-react";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import {
  getHubMonthlyInput,
  getHubSummary,
  getRegionMomoRequired,
} from "@/lib/hub/db";
import {
  buildHubMonth,
  buildMonthTrail,
  monthsEndingAt,
  type ChurchMonthRow,
  type SummaryCounts,
} from "@/lib/hub/monthly";
import { resolveMonth } from "@/lib/poc/admins-overview";
import { DownloadGiversLink } from "@/components/giving/member-month-grid";

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

const COUNT_LABELS: {
  key: keyof SummaryCounts;
  label: string;
  short: string;
}[] = [
  { key: "totalRegistered", label: "Total registered", short: "Registered" },
  { key: "activePartners", label: "Active partners", short: "Active" },
  { key: "newRegistrations", label: "New registrations", short: "New" },
  { key: "lapsed", label: "Lapsed", short: "Lapsed" },
];
const count = (n: number) => n.toLocaleString("en-US");

const METHOD_LABELS = {
  mobile_money: "MoMo",
  bank: "Bank",
  paystack: "Paystack",
  other: "Other",
} as const;

/**
 * Hub Monthly summary (Decisions 0038, 0039): for a chosen month, the giving,
 * which of the hub's churches have submitted the Monthly Summary Form, and the
 * sums of its four numbers. Cash appears only for Ghana hubs (the only ones that
 * report cash). Scoped to the signed-in hub by the session.
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
  const [summary, input, reportsCash] = session
    ? await Promise.all([
        getHubSummary(session.hubId),
        getHubMonthlyInput(session.hubId, months[0]),
        getRegionMomoRequired(session.regionCode),
      ])
    : [null, null, false];

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
  const methodNote =
    methods.length > 0
      ? methods
          .map((k) => `${METHOD_LABELS[k]} ${ghs(m.statementByMethod[k])}`)
          .join(" · ")
      : "No MoMo, bank or Paystack gifts recorded";

  const tiles = [
    ...(reportsCash
      ? [
          {
            label: "All giving",
            value: ghs(m.totalMinor),
            note: "Statements and cash together",
            icon: HandCoins,
          },
          {
            label: "Statement giving",
            value: ghs(m.statementMinor),
            note: methodNote,
            icon: Wallet,
          },
          {
            label: "Cash giving",
            value: ghs(m.cashMinor),
            note: "From the churches' monthly summary forms",
            icon: Banknote,
          },
        ]
      : [
          {
            label: "Giving",
            value: ghs(m.statementMinor),
            note: methodNote,
            icon: HandCoins,
          },
        ]),
    {
      label: "Summary forms submitted",
      value: `${m.filed.length} of ${churches}`,
      note:
        m.notFiled.length === 0
          ? churches > 0
            ? "Every church has submitted"
            : "No churches yet"
          : `${m.notFiled.length} still to submit`,
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
      <div className="flex justify-end">
        <DownloadGiversLink
          href={`/api/hub/givers?month=${month}`}
          month={month}
        />
      </div>

      <div
        className={
          "grid grid-cols-2 gap-3 " +
          (tiles.length === 4 ? "lg:grid-cols-4" : "")
        }
      >
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

      <section>
        <h2 className="text-base font-bold text-foreground">
          Monthly summary totals
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The four numbers added up across the {m.filed.length}{" "}
          {m.filed.length === 1 ? "church" : "churches"} that submitted.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {COUNT_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {count(m.summaryTotals[key])}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SubmittedTable rows={m.filed} reportsCash={reportsCash} month={month} />
      <NotSubmittedTable rows={m.notFiled} month={month} />

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
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Month</th>
                <th className="px-3 py-3 text-right">
                  {reportsCash ? "All giving" : "Giving"}
                </th>
                {COUNT_LABELS.map(({ key, short }) => (
                  <th
                    key={key}
                    className="hidden px-3 py-3 text-right sm:table-cell"
                  >
                    {short}
                  </th>
                ))}
                <th className="px-3 py-3 text-right">Forms</th>
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
                  <td className="px-3 py-3 font-semibold">
                    <Link
                      href={`/hub/summary?month=${row.month}`}
                      className="text-brand hover:underline"
                    >
                      {monthLabel(row.month)}
                    </Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right font-semibold tabular-nums">
                    {ghs(reportsCash ? row.totalMinor : row.statementMinor)}
                  </td>
                  {COUNT_LABELS.map(({ key }) => (
                    <td
                      key={key}
                      className="hidden px-3 py-3 text-right tabular-nums sm:table-cell"
                    >
                      {count(row.summaryTotals[key])}
                    </td>
                  ))}
                  <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
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
        partners, by the month the money arrived. The four numbers
        {reportsCash ? " and cash" : ""} are what each church reported on the
        Monthly Summary Form for the month.
      </p>
    </div>
  );
}

function SubmittedTable({
  rows,
  reportsCash,
  month,
}: {
  rows: ChurchMonthRow[];
  reportsCash: boolean;
  month: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-emerald-700">
        Submitted ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          No church has submitted its monthly summary for this month yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Church</th>
                {COUNT_LABELS.map(({ key, short }) => (
                  <th key={key} className="px-3 py-3 text-right">
                    {short}
                  </th>
                ))}
                <th className="hidden px-3 py-3 text-right sm:table-cell">
                  Giving
                </th>
                {reportsCash && (
                  <th className="hidden px-3 py-3 text-right sm:table-cell">
                    Cash
                  </th>
                )}
                <th className="hidden px-3 py-3 sm:table-cell">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.churchId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-3">
                    <ChurchLink row={row} month={month} />
                    {row.pastor && (
                      <span className="block text-xs text-muted-foreground">
                        {row.pastor}
                      </span>
                    )}
                  </td>
                  {COUNT_LABELS.map(({ key }) => (
                    <td key={key} className="px-3 py-3 text-right tabular-nums">
                      {count(row.counts?.[key] ?? 0)}
                    </td>
                  ))}
                  <td className="hidden px-3 py-3 whitespace-nowrap text-right tabular-nums sm:table-cell">
                    {ghs(row.statementMinor)}
                  </td>
                  {reportsCash && (
                    <td className="hidden px-3 py-3 whitespace-nowrap text-right tabular-nums sm:table-cell">
                      {ghs(row.cashMinor)}
                    </td>
                  )}
                  <td className="hidden px-3 py-3 whitespace-nowrap text-muted-foreground sm:table-cell">
                    {dayLabel(row.filedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NotSubmittedTable({
  rows,
  month,
}: {
  rows: ChurchMonthRow[];
  month: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-red-700">
        Not submitted yet ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          Every church has submitted its monthly summary for this month.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Church</th>
                <th className="hidden px-3 py-3 sm:table-cell">Pastor</th>
                <th className="px-3 py-3 text-right">Partners</th>
                <th className="px-3 py-3 text-right">Giving</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.churchId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-3">
                    <ChurchLink row={row} month={month} />
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    {row.pastor || "Not on record"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {count(row.partners)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                    {ghs(row.statementMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Church name linking to its member-by-month view (Decision 0040). */
function ChurchLink({ row, month }: { row: ChurchMonthRow; month: string }) {
  return (
    <Link
      href={`/hub/summary/${row.churchId}?month=${month}`}
      className="font-semibold text-brand hover:underline"
    >
      {row.name}
    </Link>
  );
}
