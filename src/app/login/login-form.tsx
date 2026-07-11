"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/poc";

  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    setCaps(e.getModifierState?.("CapsLock") ?? false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
      } else {
        setError("That password isn't right — check with the office and try again.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-foreground">
          Team password
        </label>
        <div className="relative flex items-center">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            onKeyDown={onKey}
            onKeyUp={onKey}
            placeholder="Enter the shared password"
            className="h-[46px] w-full rounded-[10px] border border-border bg-background pl-3 pr-[74px] text-sm text-foreground outline-none transition focus:border-success focus:bg-surface focus:ring-[3px] focus:ring-success/25 placeholder:text-muted-foreground/60"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-muted-foreground/40 hover:text-foreground"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <p className={"mt-2 min-h-[16px] text-xs " + (caps ? "font-semibold text-danger" : "text-muted-foreground/80")}>
          {caps ? "Caps Lock is on." : "Ask the office if you don't have it."}
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || password.length === 0}
        className="h-[46px] w-full rounded-[10px] bg-success text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-success/40 disabled:opacity-45"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
