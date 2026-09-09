"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "staff" | "hub";

type RegionOption = {
  code: string;
  name: string;
  hubIdentifier: string;
  hubs: { id: string; label: string; leaderName: string }[];
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/poc";

  const [mode, setMode] = useState<Mode>("staff");
  const [regions, setRegions] = useState<RegionOption[] | null>(null);
  const [regionsFailed, setRegionsFailed] = useState(false);
  const [regionCode, setRegionCode] = useState("");
  const [hubId, setHubId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded once the admin opens the hub tab, not on page load: office staff are
  // the common case and never need it.
  useEffect(() => {
    if (mode !== "hub" || regions !== null || regionsFailed) return;
    let live = true;
    fetch("/api/regions")
      .then((r) => r.json())
      .then((data: { ok?: boolean; regions?: RegionOption[] }) => {
        if (!live) return;
        if (!data.ok || !data.regions) throw new Error("no regions");
        setRegions(data.regions);
        // One region needs no choosing.
        if (data.regions.length === 1) setRegionCode(data.regions[0].code);
      })
      .catch(() => live && setRegionsFailed(true));
    return () => {
      live = false;
    };
  }, [mode, regions, regionsFailed]);

  const region = regions?.find((r) => r.code === regionCode) ?? null;

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    setCaps(e.getModifierState?.("CapsLock") ?? false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = mode === "hub" ? { hubId, password } : { password };
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
        // The hub came from a dropdown, so the password is the wrong half.
        setError(
          "That password is not correct for this hub. Check with the BENMP office and try again.",
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
        <>
          {regionsFailed ? (
            <p
              role="alert"
              className="rounded-md border border-danger/25 bg-danger/5 px-3 py-2.5 text-[13px] leading-5 text-danger"
            >
              Could not load the region list. Refresh the page, or contact the
              BENMP office.
            </p>
          ) : regions === null ? (
            <p className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              Loading regions...
            </p>
          ) : (
            <>
              <div>
                <label
                  htmlFor="region"
                  className="mb-2 block text-[13px] font-semibold text-foreground"
                >
                  Region
                </label>
                <select
                  id="region"
                  value={regionCode}
                  onChange={(e) => {
                    setRegionCode(e.target.value);
                    setHubId("");
                    setError(null);
                  }}
                  className="h-12 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand/15"
                >
                  <option value="">Choose your region</option>
                  {regions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="hub"
                  className="mb-2 block text-[13px] font-semibold text-foreground"
                >
                  Hub
                </label>
                <select
                  id="hub"
                  value={hubId}
                  disabled={!region}
                  onChange={(e) => {
                    setHubId(e.target.value);
                    setError(null);
                  }}
                  className="h-12 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <option value="">
                    {region ? "Choose your hub" : "Choose a region first"}
                  </option>
                  {region?.hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                      {h.leaderName ? ` (${h.leaderName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </>
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
          busy || password.length === 0 || (mode === "hub" && hubId === "")
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
