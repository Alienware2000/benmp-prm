import type { ComponentType } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

const metricTones: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Ready: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Configured: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Succeeded: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Matched: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Sent: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Live: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Done: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Responded: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "Active year covered": "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Open: "bg-blue-50 text-blue-700 ring-blue-100",
  New: "bg-blue-50 text-blue-700 ring-blue-100",
  Planning: "bg-blue-50 text-blue-700 ring-blue-100",
  "In progress": "bg-blue-50 text-blue-700 ring-blue-100",
  Praying: "bg-blue-50 text-blue-700 ring-blue-100",
  Standard: "bg-blue-50 text-blue-700 ring-blue-100",
  Draft: "bg-slate-100 text-slate-700 ring-slate-200",
  Drafted: "bg-slate-100 text-slate-700 ring-slate-200",
  "Not required": "bg-slate-100 text-slate-700 ring-slate-200",
  "Not started": "bg-slate-100 text-slate-700 ring-slate-200",
  Planned: "bg-slate-100 text-slate-700 ring-slate-200",
  Pending: "bg-amber-50 text-amber-700 ring-amber-100",
  Preparing: "bg-amber-50 text-amber-700 ring-amber-100",
  Review: "bg-amber-50 text-amber-700 ring-amber-100",
  Queued: "bg-amber-50 text-amber-700 ring-amber-100",
  Scheduled: "bg-amber-50 text-amber-700 ring-amber-100",
  Partial: "bg-amber-50 text-amber-700 ring-amber-100",
  Probable: "bg-amber-50 text-amber-700 ring-amber-100",
  "Needs setup": "bg-amber-50 text-amber-700 ring-amber-100",
  "Needs review": "bg-amber-50 text-amber-700 ring-amber-100",
  Reporting: "bg-amber-50 text-amber-700 ring-amber-100",
  "High touch": "bg-violet-50 text-violet-700 ring-violet-100",
  Missed: "bg-rose-50 text-rose-700 ring-rose-100",
  Failed: "bg-rose-50 text-rose-700 ring-rose-100",
  Sensitive: "bg-rose-50 text-rose-700 ring-rose-100",
  "Needs follow-up": "bg-rose-50 text-rose-700 ring-rose-100",
  Blocked: "bg-rose-50 text-rose-700 ring-rose-100",
  Unmatched: "bg-rose-50 text-rose-700 ring-rose-100",
  Restricted: "bg-rose-50 text-rose-700 ring-rose-100",
};

export function MetricCard({
  label,
  value,
  detail,
  icon: IconComponent,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: Icon;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg ring-1",
            metricTones[tone] ?? metricTones.slate,
          )}
        >
          <IconComponent className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{detail}</p>
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {title}
          </h2>
        </div>
        {action ? (
          <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
            {action}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Insight({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ring-1",
        statusStyles[label] ?? statusStyles.Draft,
      )}
    >
      {label}
    </span>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  );
}

export function TableCell({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm text-muted-foreground",
        strong && "font-semibold text-foreground",
      )}
    >
      {children}
    </td>
  );
}

export function DataTable({
  children,
  className,
  minWidth = "720px",
}: {
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-left"
          style={{ minWidth }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export type RecordColumn<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
  primary?: boolean;
  className?: string;
  cardLabel?: string;
};

export function ResponsiveRecordTable<T>({
  rows,
  columns,
  getRowKey,
  getTitle,
  getSubtitle,
  getStatus,
  minWidth = "760px",
}: {
  rows: T[];
  columns: RecordColumn<T>[];
  getRowKey: (row: T) => string;
  getTitle: (row: T) => React.ReactNode;
  getSubtitle?: (row: T) => React.ReactNode;
  getStatus?: (row: T) => string;
  minWidth?: string;
}) {
  const detailColumns = columns.filter(
    (column) => !column.primary && column.header !== "Status",
  );

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article
            key={getRowKey(row)}
            className="rounded-lg border border-border bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {getTitle(row)}
                </h3>
                {getSubtitle ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {getSubtitle(row)}
                  </p>
                ) : null}
              </div>
              {getStatus ? <StatusBadge label={getStatus(row)} /> : null}
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {detailColumns.map((column) => (
                <div key={column.header} className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {column.cardLabel ?? column.header}
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {column.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <DataTable className="hidden md:block" minWidth={minWidth}>
        <thead className="bg-muted/70">
          <tr>
            {columns.map((column) => (
              <TableHeader key={column.header}>{column.header}</TableHeader>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="hover:bg-muted/40">
              {columns.map((column) => (
                <TableCell key={column.header} strong={column.primary}>
                  <div className={column.className}>{column.render(row)}</div>
                </TableCell>
              ))}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
