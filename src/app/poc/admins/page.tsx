import Link from "next/link";
import { loadAdminsInput } from "@/lib/poc/admins-data";
import {
  buildBlocks,
  computeHubStats,
  resolveMonth,
} from "@/lib/poc/admins-overview";
import { MonthPicker, Stat, money, monthLabel, ofTotal } from "./ui";

export const dynamic = "force-dynamic";

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const month = resolveMonth((await searchParams).month);
  const input = await loadAdminsInput(month);
  const blocks = buildBlocks(input.regions, computeHubStats(input, month));

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 lg:pb-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admins</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every hub admin&apos;s report for {monthLabel(month)}. Open a
              block to see its hubs.
            </p>
          </div>
          <MonthPicker month={month} action="/poc/admins" />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((b) => {
            const admins = ofTotal(b.adminsSignedIn, b.hubs);
            const cash = ofTotal(b.cashFiled, b.branches);
            const card = (
              <div
                className={
                  "h-full rounded-lg border border-border bg-surface p-4 shadow-sm transition " +
                  (b.setUp && b.hubs > 0
                    ? "hover:border-brand hover:shadow"
                    : "opacity-70")
                }
              >
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold text-foreground">
                    {b.label}
                  </h2>
                  {b.setUp && (
                    <span className="text-xs text-muted-foreground">
                      {b.hubs} {b.hubs === 1 ? "hub" : "hubs"}
                    </span>
                  )}
                </div>
                {b.setUp && b.hubs > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    <Stat
                      label="Admins signed in"
                      value={admins.value}
                      tone={admins.tone}
                    />
                    <Stat
                      label="Partners"
                      value={b.partners.toLocaleString("en-US")}
                    />
                    <Stat
                      label="Branches"
                      value={b.branches.toLocaleString("en-US")}
                    />
                    <Stat
                      label="Cash reports filed"
                      value={cash.value}
                      tone={cash.tone}
                    />
                    <Stat
                      label="Giving this month"
                      value={money(b.givingMinor)}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Not set up yet. Its hubs and branches have not been added.
                  </p>
                )}
              </div>
            );
            return b.setUp && b.hubs > 0 && b.regionCode ? (
              <Link
                key={b.label}
                href={`/poc/admins/${b.regionCode.toLowerCase()}?month=${month}`}
              >
                {card}
              </Link>
            ) : (
              <div key={b.label}>{card}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
