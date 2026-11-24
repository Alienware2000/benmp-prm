"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Removed = { id: string; name: string; church: string | null; removedAt: string };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Members a Monthly Summary Form marked Remove, each with a Restore button (Decision 0047). */
export function RemovedList({ removed }: { removed: Removed[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/hub/partners/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerIds: [id] }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not restore.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-foreground">
        Removed on the Monthly Summary Form ({removed.length})
      </h2>
      <p className="text-xs text-muted-foreground">
        A church marked these people Remove. They are hidden from the church&apos;s list,
        not deleted. Restore anyone removed by mistake.
      </p>
      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</p>}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {removed.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-semibold">{r.name}</span>
              <span className="block text-xs text-muted-foreground">
                {r.church ?? "No church"} · removed {day(r.removedAt)}
              </span>
            </span>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => restore(r.id)}
              className="rounded border border-border px-3 py-1 text-xs font-semibold hover:border-brand disabled:opacity-50"
            >
              {busy === r.id ? "Restoring…" : "Restore"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
