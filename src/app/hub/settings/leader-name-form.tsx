"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

/** Edit the leader/contact name shown across the hub's pages. */
export function LeaderNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== initialName;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/hub/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leaderName: name }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(data.error ?? "Could not save. Try again.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label
        htmlFor="leader-name"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Leader / contact name
      </label>
      <div className="mt-1 flex max-w-md gap-2">
        <input
          id="leader-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
            setSaved(false);
          }}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/15"
        />
        <button
          type="submit"
          disabled={busy || !dirty || name.trim().length < 2}
          className="h-10 flex-none rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            "Save"
          )}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] text-danger">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-2 flex items-start gap-1.5 text-[13px] text-success">
          <CircleCheck className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
          Saved.
        </p>
      )}
    </form>
  );
}
