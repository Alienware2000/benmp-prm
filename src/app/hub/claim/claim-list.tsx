"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ClaimableGiver } from "@/lib/hub/claim";
import type { ClaimedPartner } from "@/lib/hub/db";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const PAGE = 100;

export function ClaimList({
  givers,
  churches,
  claimed,
}: {
  givers: ClaimableGiver[];
  churches: { id: string; name: string }[];
  claimed: ClaimedPartner[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [onlyMentions, setOnlyMentions] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [churchId, setChurchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const mentionCount = useMemo(
    () => givers.filter((g) => g.mentions).length,
    [givers],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return givers.filter(
      (g) =>
        (!onlyMentions || g.mentions) &&
        (!q ||
          [g.name, g.phoneHint ?? "", ...g.notes]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [givers, query, onlyMentions]);

  async function post(body: Record<string, string>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/hub/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage({ ok: false, text: data.error ?? "Something went wrong." });
        return false;
      }
      return data as { ok: true; name?: string };
    } catch {
      setMessage({ ok: false, text: "Network error. Please try again." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function claim(giver: ClaimableGiver) {
    const data = await post({
      action: "claim",
      partnerId: giver.id,
      churchId,
    });
    if (!data) return;
    const church = churches.find((c) => c.id === churchId)?.name ?? "";
    setMessage({
      ok: true,
      text: `${giver.name} is now in your hub under ${church}.`,
    });
    setOpenId(null);
    setChurchId("");
    router.refresh();
  }

  async function release(partner: ClaimedPartner) {
    if (
      !window.confirm(
        `Release ${partner.full_name}? They will go back to the unclaimed list.`,
      )
    )
      return;
    const data = await post({ action: "release", partnerId: partner.id });
    if (!data) return;
    setMessage({ ok: true, text: `${partner.full_name} was released.` });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {message && (
        <p
          className={
            "rounded-lg p-3 text-sm " +
            (message.ok
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800")
          }
        >
          {message.text}
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlyMentions}
              onChange={(e) => setOnlyMentions(e.target.checked)}
            />
            Only those whose note names your hub or churches ({mentionCount})
          </label>
          <label className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search name, last digits, note"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            {givers.length === 0
              ? "There are no unclaimed givers right now."
              : "No one matches that search."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.slice(0, limit).map((g) => (
              <li key={g.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {g.name}
                      {g.phoneHint && (
                        <span className="ml-2 text-sm tabular-nums text-muted-foreground">
                          {g.phoneHint}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last gave {fmtDate(g.lastGiftAt)} · {g.giftCount} gift
                      {g.giftCount === 1 ? "" : "s"}
                      {g.mentions && (
                        <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 font-semibold text-brand">
                          Mentions {g.mentions}
                        </span>
                      )}
                    </p>
                    {g.notes.length > 0 && (
                      <p className="mt-1 break-words text-xs text-foreground">
                        Note: {g.notes.map((n) => `“${n}”`).join(" · ")}
                      </p>
                    )}
                  </div>
                  {openId !== g.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(g.id);
                        setChurchId("");
                        setMessage(null);
                      }}
                      className="rounded-md border border-border px-3 py-1 text-sm font-semibold text-brand"
                    >
                      Claim
                    </button>
                  )}
                </div>
                {openId === g.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={churchId}
                      onChange={(e) => setChurchId(e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    >
                      <option value="">Which church?</option>
                      {churches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!churchId || busy}
                      onClick={() => claim(g)}
                      className="rounded-md bg-brand px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy ? "Claiming…" : "Confirm claim"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenId(null)}
                      className="text-sm text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {filtered.length > limit && (
          <div className="border-t border-border p-3 text-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="text-sm font-semibold text-brand"
            >
              Show more ({(filtered.length - limit).toLocaleString()} left)
            </button>
          </div>
        )}
      </div>

      {claimed.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <h2 className="border-b border-border p-3 text-sm font-semibold text-foreground">
            Claimed by your hub ({claimed.length})
          </h2>
          <ul className="divide-y divide-border">
            {claimed.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 p-3 text-sm"
              >
                <span>
                  <span className="font-medium text-foreground">
                    {p.full_name}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {p.church ?? ""} · claimed {fmtDate(p.claimed_at)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => release(p)}
                  className="text-sm text-muted-foreground underline disabled:opacity-50"
                >
                  Release
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
