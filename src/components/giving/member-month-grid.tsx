// src/components/giving/member-month-grid.tsx
// The member-by-month table for one church (Decision 0040), shared by the
// office Admins tab and the hub's Monthly summary drill-down.
import type { ChurchMemberView } from "@/lib/hub/church-members";

const ghs = (minor: number) =>
  minor === 0
    ? "–"
    : (minor / 100).toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const shortMonth = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

export function MemberMonthGrid({
  view,
  selectedMonth,
  reportsCash,
}: {
  view: ChurchMemberView;
  selectedMonth: string;
  reportsCash: boolean;
}) {
  const highlight = (month: string) =>
    month === selectedMonth ? " bg-brand/5" : "";
  const cell = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
  const sticky = "sticky left-0 z-10 bg-surface";

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={`${sticky} px-3 py-3`}>Member</th>
            {view.months.map((m) => (
              <th key={m} className={`${cell} py-3${highlight(m)}`}>
                {shortMonth(m)}
              </th>
            ))}
            <th className={`${cell} py-3`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {view.members.length === 0 && (
            <tr>
              <td
                colSpan={view.months.length + 2}
                className="px-3 py-4 text-muted-foreground"
              >
                No members on this church&apos;s list yet.
              </td>
            </tr>
          )}
          {view.members.map((member) => (
            <tr
              key={member.id}
              className="border-b border-border last:border-0"
            >
              <td className={`${sticky} px-3 py-2`}>
                <span className="font-semibold">{member.name}</span>
                {member.phone && (
                  <span className="block text-xs text-muted-foreground">
                    {member.phone}
                  </span>
                )}
              </td>
              {view.months.map((m) => (
                <td
                  key={m}
                  className={
                    cell +
                    highlight(m) +
                    (member.byMonth[m] === 0 ? " text-muted-foreground" : "")
                  }
                >
                  {ghs(member.byMonth[m])}
                </td>
              ))}
              <td className={`${cell} font-semibold`}>
                {ghs(member.totalMinor)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border text-sm">
          <tr>
            <th className={`${sticky} px-3 py-2 text-left`}>
              Members&apos; giving
            </th>
            {view.months.map((m) => (
              <td key={m} className={`${cell} font-semibold${highlight(m)}`}>
                {ghs(view.monthTotals[m])}
              </td>
            ))}
            <td className={`${cell} font-bold`}>{ghs(view.totalMinor)}</td>
          </tr>
          <tr>
            <th
              className={`${sticky} px-3 py-2 text-left font-normal text-muted-foreground`}
            >
              Members who gave
            </th>
            {view.months.map((m) => (
              <td
                key={m}
                className={`${cell} text-muted-foreground${highlight(m)}`}
              >
                {view.giversByMonth[m]}
              </td>
            ))}
            <td className={`${cell} text-muted-foreground`}>
              {view.givingMembers}
            </td>
          </tr>
          {reportsCash && (
            <tr>
              <th
                className={`${sticky} px-3 py-2 text-left font-normal text-muted-foreground`}
              >
                Cash on the form
              </th>
              {view.months.map((m) => {
                const form = view.formByMonth[m];
                return (
                  <td
                    key={m}
                    className={`${cell} text-muted-foreground${highlight(m)}`}
                  >
                    {form ? ghs(form.cashMinor) : "not submitted"}
                  </td>
                );
              })}
              <td className={`${cell} text-muted-foreground`}>
                {ghs(
                  view.months.reduce(
                    (sum, m) => sum + (view.formByMonth[m]?.cashMinor ?? 0),
                    0,
                  ),
                )}
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

/** The church's Monthly Summary Form for one month, as a short line. */
export function FormLine({
  view,
  month,
}: {
  view: ChurchMemberView;
  month: string;
}) {
  const form = view.formByMonth[month];
  if (!form) {
    return (
      <p className="text-sm font-semibold text-red-700">
        Monthly summary not submitted for this month.
      </p>
    );
  }
  const c = form.counts;
  return (
    <p className="text-sm text-emerald-700">
      <span className="font-semibold">Monthly summary submitted</span>
      {form.submittedAt
        ? ` on ${new Date(form.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`
        : ""}
      : {c.totalRegistered} registered · {c.activePartners} active ·{" "}
      {c.newRegistrations} new · {c.lapsed} lapsed
    </p>
  );
}

/** Downloads the month's givers as a contact CSV for a broadcast (Decision 0041). */
export function DownloadGiversLink({
  href,
  month,
}: {
  href: string;
  month: string;
}) {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1.5 rounded border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/5"
    >
      Download {label} givers (CSV)
    </a>
  );
}
