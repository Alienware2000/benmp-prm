"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";

type ReviewRow = {
  id: string;
  payment_reference: string | null;
  normalized_row: {
    sourceRowId: string;
    transactionDate: string;
    amountMinor: number;
    currency: string;
    payerName: string | null;
    payerPhoneOrAccount: string | null;
  };
  notes: string | null;
  created_at: string;
};

type PartnerOption = { id: string; name: string; phone: string | null; church: string | null };
type Decision = { action: "dismiss" } | { action: "match"; partnerId: string } | { action: "create"; name: string };

const inputClass = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand";

function money(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : { ok: false, error: "Empty response." };
}

export function GivingReviewClient({
  initialRows,
  initialPartnerOptions,
}: {
  initialRows: ReviewRow[];
  initialPartnerOptions: PartnerOption[];
}) {
  const [rows, setRows] = useState<ReviewRow[]>(initialRows);
  const [partners, setPartners] = useState<PartnerOption[]>(initialPartnerOptions);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/poc/giving/review");
      const body = await readJson(response);
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Could not load review queue.");
      setRows(body.rows ?? []);
      setPartners(body.partnerOptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load review queue.");
    } finally {
      setBusy(false);
    }
  }

  async function save(row: ReviewRow) {
    const decision = decisions[row.id];
    if (!decision) {
      setError("Choose an action first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("id", row.id);
      form.set("row", JSON.stringify(row.normalized_row));
      form.set("decision", JSON.stringify(decision));
      const response = await fetch("/api/poc/giving/review", { method: "POST", body: form });
      const body = await readJson(response);
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Could not save review action.");
      setRows((current) => current.filter((item) => item.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Pending uploaded rows</h2>
          <p className="mt-1 text-xs text-muted-foreground">{rows.length.toLocaleString("en-US")} rows need review.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
      {error && <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {busy && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
      <div className="mt-4 grid gap-3">
        {rows.map((item) => {
          const decision = decisions[item.id] ?? { action: "dismiss" };
          return (
            <article key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold">{item.normalized_row.payerName || "Unknown giver"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.normalized_row.transactionDate.slice(0, 10)} · {money(item.normalized_row.amountMinor, item.normalized_row.currency)} · {item.notes ?? "Needs review"}
                  </p>
                </div>
                <button type="button" disabled={busy} onClick={() => save(item)} className="inline-flex h-9 items-center gap-2 rounded-md bg-brand px-3 text-xs font-semibold text-white disabled:opacity-60">
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
                <select className={inputClass} value={decision.action} onChange={(event) => {
                  const action = event.target.value as Decision["action"];
                  if (action === "dismiss") setDecisions((d) => ({ ...d, [item.id]: { action } }));
                  if (action === "match") setDecisions((d) => ({ ...d, [item.id]: { action, partnerId: partners[0]?.id ?? "" } }));
                  if (action === "create") setDecisions((d) => ({ ...d, [item.id]: { action, name: item.normalized_row.payerName ?? "" } }));
                }}>
                  <option value="dismiss">Dismiss</option>
                  <option value="match">Match existing</option>
                  <option value="create">Create new</option>
                </select>
                {decision.action === "match" && (
                  <select className={inputClass} value={decision.partnerId} onChange={(event) => setDecisions((d) => ({ ...d, [item.id]: { action: "match", partnerId: event.target.value } }))}>
                    {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}{partner.phone ? ` · ${partner.phone}` : ""}{partner.church ? ` · ${partner.church}` : ""}</option>)}
                  </select>
                )}
                {decision.action === "create" && (
                  <input className={inputClass} value={decision.name} onChange={(event) => setDecisions((d) => ({ ...d, [item.id]: { action: "create", name: event.target.value } }))} />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
