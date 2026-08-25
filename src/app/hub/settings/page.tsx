import { cookies } from "next/headers";
import { CalendarClock, KeyRound, UserRound } from "lucide-react";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import { getHubAccountMeta, getHubSummary } from "@/lib/hub/db";
import { PasswordForm } from "../password/password-form";
import { LeaderNameForm } from "./leader-name-form";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Hub account settings: identity, editable details, and security. */
export default async function HubSettingsPage() {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  const [summary, meta] = session
    ? await Promise.all([
        getHubSummary(session.hubId),
        getHubAccountMeta(session.accountId),
      ])
    : [null, null];

  if (!session || !summary) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load this hub. Sign out and back in.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your hub&apos;s account details and security.
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3 sm:px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
            <UserRound className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Account</h2>
            <p className="text-xs text-muted-foreground">
              The hub number is your sign-in name and never changes.
            </p>
          </div>
        </header>
        <div className="grid gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hub number
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {summary.hubNumber}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Churches in this hub
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {summary.churchCount}
            </p>
          </div>
          <div className="sm:col-span-2">
            <LeaderNameForm initialName={summary.leaderName} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3 sm:px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
            <KeyRound className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Password</h2>
            <p className="text-xs text-muted-foreground">
              At least 8 characters, never the hub number. Forgot it? The BENMP
              office can reset it.
            </p>
          </div>
        </header>
        <div className="max-w-md px-4 py-4 sm:px-5">
          <PasswordForm embedded />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3 sm:px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
            <CalendarClock className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        </header>
        <div className="grid gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Last sign-in
            </p>
            <p className="mt-1 text-sm text-foreground">
              {formatDate(meta?.lastLoginAt ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Account created
            </p>
            <p className="mt-1 text-sm text-foreground">
              {formatDate(meta?.createdAt ?? null)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
