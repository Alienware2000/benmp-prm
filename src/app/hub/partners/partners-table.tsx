"use client";

import { Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { HubPartnerRow, HubUpload } from "@/lib/hub/db";
import { partnersAddedByUpload } from "@/lib/hub/delete";

type Result = {
  deleted: number;
  kept: { id: string; name: string; reason: string }[];
};

const fmtUpload = (u: HubUpload) =>
  `${u.file_name} · ${new Date(u.created_at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;

/**
 * Searchable, hub-scoped partner list. Search covers name, phone, church.
 * Admins can tick people, or pick one of their uploads, and remove them
 * (Decision 0029). Anyone with giving on record is kept by the server.
 */
export function PartnersTable({
  partners,
  uploads,
  showMomo,
}: {
  partners: HubPartnerRow[];
  uploads: HubUpload[];
  showMomo: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [uploadId, setUploadId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const filtered = useMemo(() => {
    const upload = uploads.find((u) => u.id === uploadId);
    const base = upload ? partnersAddedByUpload(upload, partners) : partners;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) =>
      [p.full_name, p.momo_phone_number, p.whatsapp_number, p.church ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [partners, uploads, uploadId, query]);

  const allShownSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirming(false);
  }

  function toggleAllShown() {
    setSelected((s) => {
      const next = new Set(s);
      if (allShownSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
    setConfirming(false);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/partners/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partnerIds: [...selected] }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      } & Partial<Result>;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not remove them. Try again.");
        return;
      }
      setResult({ deleted: data.deleted ?? 0, kept: data.kept ?? [] });
      setSelected(new Set());
      setConfirming(false);
      router.refresh();
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, number, or church"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/15 placeholder:text-muted-foreground/60"
          />
        </div>
        {uploads.length > 0 && (
          <select
            value={uploadId}
            onChange={(e) => {
              setUploadId(e.target.value);
              setConfirming(false);
            }}
            aria-label="Show one upload"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground sm:w-auto"
          >
            <option value="">All uploads</option>
            {uploads.map((u) => (
              <option key={u.id} value={u.id}>
                {fmtUpload(u)}
              </option>
            ))}
          </select>
        )}
      </div>

      {result && (
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <p className="font-semibold text-foreground">
            Removed {result.deleted}{" "}
            {result.deleted === 1 ? "partner" : "partners"}.
          </p>
          {result.kept.length > 0 && (
            <>
              <p className="mt-1 text-muted-foreground">
                {result.kept.length} kept because they have giving on record.
                Ask the BENMP office if they must be removed:
              </p>
              <p className="mt-0.5 text-foreground">
                {result.kept.map((k) => k.name).join(", ")}
              </p>
            </>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm">
          {!confirming ? (
            <>
              <span className="font-semibold text-foreground">
                {selected.size} selected
              </span>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-danger px-3 text-xs font-semibold text-white hover:opacity-90"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove from the system
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <span className="text-foreground">
                Remove <span className="font-semibold">{selected.size}</span>{" "}
                {selected.size === 1 ? "partner" : "partners"} from the system?
                This cannot be undone from here.
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={remove}
                className="inline-flex h-9 items-center rounded-md bg-danger px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Removing…" : "Yes, remove"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </>
          )}
          {error && <p className="w-full text-xs text-danger">{error}</p>}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query.trim() ? `No one matches “${query.trim()}”.` : "No one here."}
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded border border-border">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted text-xs font-semibold text-muted-foreground">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={toggleAllShown}
                    aria-label="Select everyone shown"
                    className="h-4 w-4 accent-brand"
                  />
                </th>
                <th className="px-3 py-2">Name</th>
                {showMomo && <th className="px-3 py-2">MoMo number</th>}
                <th className="px-3 py-2">WhatsApp number</th>
                <th className="px-3 py-2">Church</th>
                <th className="px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={
                    selected.has(p.id) ? "bg-danger/5" : "odd:bg-background"
                  }
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.full_name}`}
                      className="h-4 w-4 accent-brand"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {p.full_name}
                  </td>
                  {showMomo && (
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground">
                      {p.momo_phone_number}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground">
                    {p.whatsapp_number}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {p.church ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {p.created_at.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
