import Link from "next/link";
import { formatGhs } from "@/lib/poc/answers";

export function money(minor: number): string {
  return `GHS ${formatGhs(minor)}`;
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function dateLabel(iso: string | null): string {
  if (!iso) return "Not yet";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A plain GET form, so the month lives in the address and survives a reload. */
export function MonthPicker({
  month,
  action,
}: {
  month: string;
  action: string;
}) {
  return (
    <form action={action} className="flex items-center gap-2">
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
  );
}

export function Crumbs({
  month,
  trail,
}: {
  month: string;
  trail: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <Link
        href={`/poc/admins?month=${month}`}
        className="hover:text-foreground"
      >
        Admins
      </Link>
      {trail.map((t) => (
        <span key={t.label}>
          {" / "}
          {t.href ? (
            <Link href={t.href} className="hover:text-foreground">
              {t.label}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{t.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const colour =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-red-700"
        : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${colour}`}>{value}</span>
    </div>
  );
}

/** "3 of 5" with a warning tone when some are missing. */
export function ofTotal(
  done: number,
  total: number,
): { value: string; tone?: "good" | "warn" } {
  if (total === 0) return { value: "0" };
  return {
    value: `${done} of ${total}`,
    tone: done === total ? "good" : "warn",
  };
}
