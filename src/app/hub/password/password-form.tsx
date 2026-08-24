"use client";

import { CircleAlert, LoaderCircle, Save } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "h-12 w-full rounded-md border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand/15 placeholder:text-muted-foreground/60";

export function PasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (next !== confirm) {
      setError("The two copies of the new password do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        router.replace("/hub");
        router.refresh();
      } else {
        setError(data.error ?? "Could not change the password. Try again.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="current"
          className="mb-2 block text-[13px] font-semibold text-foreground"
        >
          Current password
        </label>
        <input
          id="current"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setError(null);
          }}
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="new"
          className="mb-2 block text-[13px] font-semibold text-foreground"
        >
          New password
        </label>
        <input
          id="new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setError(null);
          }}
          className={inputClass}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          At least 8 characters. Not the hub number.
        </p>
      </div>
      <div>
        <label
          htmlFor="confirm"
          className="mb-2 block text-[13px] font-semibold text-foreground"
        >
          New password again
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError(null);
          }}
          className={inputClass}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/5 px-3 py-2.5 text-[13px] leading-5 text-danger"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || current === "" || next === "" || confirm === ""}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/40 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? (
          <>
            <LoaderCircle className="h-[18px] w-[18px] animate-spin" aria-hidden />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-[18px] w-[18px]" aria-hidden />
            Save new password
          </>
        )}
      </button>
    </form>
  );
}
