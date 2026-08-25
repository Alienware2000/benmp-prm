"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { FormEvent, KeyboardEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "staff" | "hub";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/poc";

  const [mode, setMode] = useState<Mode>("staff");
  const [hubNumber, setHubNumber] = useState("");
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
      const body =
        mode === "hub" ? { hubNumber, password } : { password };
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (mode === "hub") {
          const data = (await res.json().catch(() => ({}))) as {
            mustChange?: boolean;
          };
          router.replace(data.mustChange ? "/hub/password" : "/hub");
        } else {
          router.replace(next);
        }
        router.refresh();
      } else if (mode === "hub") {
        setError(
          "That hub number and password combination is not correct. Check with the BENMP office and try again.",
        );
      } else {
        setError(
          "That password is not correct. Check with the BENMP office and try again.",
        );
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div
        role="tablist"
        aria-label="Sign-in type"
        className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-1"
      >
        {(
          [
            ["staff", "Office staff"],
            ["hub", "Hub leader"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={
              "h-9 rounded text-[13px] font-semibold transition " +
              (mode === value
                ? "bg-brand text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "hub" && (
        <div>
          <label
            htmlFor="hub-number"
            className="mb-2 block text-[13px] font-semibold text-foreground"
          >
            Hub number
          </label>
          <input
            id="hub-number"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            value={hubNumber}
            onChange={(e) => {
              setHubNumber(e.target.value);
              setError(null);
            }}
            placeholder="e.g. 12"
            className="h-12 w-full rounded-md border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand/15 placeholder:text-muted-foreground/60"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-[13px] font-semibold text-foreground"
        >
          {mode === "hub" ? "Hub password" : "Office password"}
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
            placeholder="Enter password"
            className="h-12 w-full rounded-md border border-border bg-background px-3.5 pr-12 text-sm text-foreground outline-none transition focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand/15 placeholder:text-muted-foreground/60"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            aria-label={show ? "Hide password" : "Show password"}
            title={show ? "Hide password" : "Show password"}
            className="absolute right-1.5 grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/40"
          >
            {show ? (
              <EyeOff className="h-[18px] w-[18px]" aria-hidden />
            ) : (
              <Eye className="h-[18px] w-[18px]" aria-hidden />
            )}
          </button>
        </div>
        <p
          className={
            "mt-2 min-h-[18px] text-xs " +
            (caps ? "font-semibold text-danger" : "text-muted-foreground")
          }
        >
          {caps
            ? "Caps Lock is on."
            : mode === "hub"
              ? "First time signing in? Your starting password is your hub number."
              : "Use the password provided by the BENMP office."}
        </p>
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
        disabled={
          busy ||
          password.length === 0 ||
          (mode === "hub" && hubNumber.trim().length === 0)
        }
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/40 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? (
          <>
            <LoaderCircle
              className="h-[18px] w-[18px] animate-spin"
              aria-hidden
            />
            Signing in...
          </>
        ) : (
          <>
            <LogIn className="h-[18px] w-[18px]" aria-hidden />
            Sign in
          </>
        )}
      </button>
    </form>
  );
}
