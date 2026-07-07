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
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Sent: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Live: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Open: "bg-blue-50 text-blue-700 ring-blue-100",
  New: "bg-blue-50 text-blue-700 ring-blue-100",
  Draft: "bg-slate-100 text-slate-700 ring-slate-200",
  Preparing: "bg-amber-50 text-amber-700 ring-amber-100",
  Review: "bg-amber-50 text-amber-700 ring-amber-100",
  Queued: "bg-amber-50 text-amber-700 ring-amber-100",
  Missed: "bg-rose-50 text-rose-700 ring-rose-100",
  Failed: "bg-rose-50 text-rose-700 ring-rose-100",
  Sensitive: "bg-rose-50 text-rose-700 ring-rose-100",
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
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
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
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
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
        "inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ring-1",
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

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          {children}
        </table>
      </div>
    </div>
  );
}
