"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  WandSparkles,
} from "lucide-react";
import { StatusBadge } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";

const initialRows = [
  {
    reference: "PAY-10492",
    donor: "Ama S.",
    amount: "$120",
    channel: "Paystack card",
    match: "Ama Serwaa",
    confidence: 98,
    status: "Approved",
  },
  {
    reference: "PAY-10493",
    donor: "D. Okafor",
    amount: "$5,000",
    channel: "Bank transfer",
    match: "Daniel Okafor",
    confidence: 96,
    status: "Approved",
  },
  {
    reference: "PAY-10494",
    donor: "Marie N.",
    amount: "XOF 40,000",
    channel: "Mobile money",
    match: "Marie N'Guessan",
    confidence: 82,
    status: "Review",
  },
  {
    reference: "PAY-10495",
    donor: "S. Tetteh",
    amount: "$50",
    channel: "PayPal",
    match: "Samuel Tetteh",
    confidence: 76,
    status: "Review",
  },
];

export function GivingReconciliation() {
  const [rows, setRows] = useState(initialRows);
  const [hasRun, setHasRun] = useState(false);

  const runReconciliation = () => {
    setRows((current) =>
      current.map((row) =>
        row.status === "Review"
          ? {
              ...row,
              confidence: Math.min(row.confidence + 10, 94),
              status: "Queued",
            }
          : row,
      ),
    );
    setHasRun(true);
  };

  const acceptQueued = () => {
    setRows((current) =>
      current.map((row) =>
        row.status === "Queued" ? { ...row, status: "Approved" } : row,
      ),
    );
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            AI-assisted import
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Payment Reconciliation
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Simulate a Paystack/PayPal import, match rows to partners, and keep
            ambiguous records in a finance review queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runReconciliation}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            <WandSparkles className="h-4 w-4" />
            Run AI match
          </button>
          <button
            onClick={acceptQueued}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold"
          >
            <CheckCircle2 className="h-4 w-4" />
            Accept queued
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-muted/70">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Donor
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Suggested Match
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map((row) => (
                  <tr key={row.reference} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">
                      {row.reference}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {row.donor}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {row.amount}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {row.match}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-2 rounded-full",
                              row.confidence >= 90
                                ? "bg-emerald-500"
                                : "bg-amber-500",
                            )}
                            style={{ width: `${row.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {row.confidence}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-primary ring-1 ring-amber-100">
            {hasRun ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {hasRun ? "Review queue prepared" : "Ready to reconcile"}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {hasRun
              ? "Probable matches were queued for staff approval. Nothing is written to giving history until finance approves it."
              : "The MVP can show reconciliation behavior with mock data before Paystack or PayPal credentials are connected."}
          </p>
          <div className="mt-4 rounded-lg bg-muted p-3">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Production version stores provider references and audit logs, not
              card data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
