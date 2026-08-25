import { cookies } from "next/headers";
import { KeyRound } from "lucide-react";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

/**
 * Forced password change (HP-2, Decision 0018 item 3). While
 * must_change_password is true, the proxy sends every hub request here.
 */
export default async function HubPasswordPage() {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  const forced = session?.mustChange ?? false;

  return (
    <div className="mx-auto max-w-[440px]">
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          {forced ? "First sign-in" : "Password"}
        </span>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          {forced ? "Choose your hub's password" : "Change your hub's password"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {forced
            ? "Before anything else, replace the starting password with one only your hub knows. At least 8 characters, and not the hub number."
            : "Pick a new password of at least 8 characters. It cannot be the hub number."}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[0_12px_36px_rgba(23,33,38,0.08)]">
        <div className="h-1 bg-accent" />
        <div className="p-5 sm:p-6">
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
