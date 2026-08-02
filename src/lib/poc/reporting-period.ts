import type { ReconciliationResult } from "../reconcile";

export type ReportingPeriod = {
  start: string | null;
  end: string | null;
  label: string;
  compactLabel: string;
};

function validDate(iso: string): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPart(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

function formatRange(dates: Date[], month: "long" | "short"): string {
  if (dates.length === 0) return "No giving data loaded";

  const start = dates[0];
  const end = dates[dates.length - 1];
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const sameDay = sameMonth && start.getUTCDate() === end.getUTCDate();

  if (sameDay) {
    return formatPart(start, { month, day: "numeric", year: "numeric" });
  }

  if (sameMonth) {
    return `${formatPart(start, { month, day: "numeric" })}–${formatPart(end, {
      day: "numeric",
      year: "numeric",
    })}`;
  }

  if (sameYear) {
    return `${formatPart(start, { month, day: "numeric" })} – ${formatPart(
      end,
      {
        month,
        day: "numeric",
        year: "numeric",
      },
    )}`;
  }

  return `${formatPart(start, {
    month,
    day: "numeric",
    year: "numeric",
  })} – ${formatPart(end, {
    month,
    day: "numeric",
    year: "numeric",
  })}`;
}

/** The exact date window represented by the currently loaded successful gifts. */
export function reportingPeriod(result: ReconciliationResult): ReportingPeriod {
  const dates = [
    ...result.registeredPaid.flatMap((giver) => giver.payments),
    ...result.paidUnregistered.flatMap((giver) => giver.payments),
    ...result.statementRows,
  ]
    .map((payment) => validDate(payment.paidAt))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    start: dates[0]?.toISOString() ?? null,
    end: dates.at(-1)?.toISOString() ?? null,
    label: formatRange(dates, "long"),
    compactLabel: formatRange(dates, "short"),
  };
}
