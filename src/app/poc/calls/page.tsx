import {
  buildCallCandidates,
  filterCallCandidates,
  type CallReason,
} from "@/lib/poc/calls";
import { loadGivingLedger } from "@/lib/poc/giving";
import { PocShell } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  filtered?: string;
  consistent?: string;
  top?: string;
}>;

const FIELD_LABEL = "text-sm font-medium text-foreground";

function ghs(currency: string, minor: number): string {
  return `${currency} ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const REASON_LABEL: Record<CallReason, string> = {
  consistent: "Consistent giver",
  top: "Top giver",
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  // A GET checkbox that's unchecked is simply absent from the query string, so a plain
  // navigation (no query string at all) is indistinguishable from "both unchecked" unless
  // the form marks itself as submitted. `filtered` is that marker.
  const wasSubmitted = sp.filtered === "1";
  const consistent = wasSubmitted ? sp.consistent === "1" : true;
  const top = wasSubmitted ? sp.top === "1" : true;

  const ledger = await loadGivingLedger();
  const candidates = buildCallCandidates(ledger);
  const rows = filterCallCandidates(candidates, { consistent, top });

  return (
    <PocShell
      current="/poc/calls"
      title="Calls"
      subtitle="Partners worth a personal call — consistent givers and top givers, by phone."
    >
      <form
        method="GET"
        className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-surface p-4"
      >
        <input type="hidden" name="filtered" value="1" />
        <label className={`flex items-center gap-2 ${FIELD_LABEL}`}>
          <input
            type="checkbox"
            name="consistent"
            value="1"
            defaultChecked={consistent}
            className="h-4 w-4 accent-[var(--success)]"
          />
          Consistent givers (2+ gifts)
        </label>
        <label className={`flex items-center gap-2 ${FIELD_LABEL}`}>
          <input
            type="checkbox"
            name="top"
            value="1"
            defaultChecked={top}
            className="h-4 w-4 accent-[var(--success)]"
          />
          Top givers
        </label>
        <button
          type="submit"
          className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Apply
        </button>
      </form>

      <p className="mt-3 text-xs text-muted-foreground">
        {rows.length === 0
          ? "No one matches the selected criteria."
          : `${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "partner" : "partners"} to call.`}
      </p>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-2 py-2.5 font-semibold">Branch</th>
              <th className="px-2 py-2.5 font-semibold">Country</th>
              <th className="px-2 py-2.5 font-semibold">WhatsApp</th>
              <th className="px-2 py-2.5 text-right font-semibold">Gifts</th>
              <th className="px-2 py-2.5 text-right font-semibold">
                Total given
              </th>
              <th className="px-4 py-2.5 font-semibold">Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No one matches those filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.phone}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-2 py-2.5 text-muted-foreground">
                  {r.branch}
                </td>
                <td className="px-2 py-2.5 text-muted-foreground">
                  {r.country}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-muted-foreground">
                  {r.phone}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {r.giftCount}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {ghs(r.currency, r.totalMinor)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {r.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                      >
                        {REASON_LABEL[reason]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PocShell>
  );
}
