import { cookies } from "next/headers";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import { HubNav } from "./nav";
import { HubSignOut } from "./sign-out";

export const dynamic = "force-dynamic";

/**
 * Shell for the hub-admin area (HP-2). The proxy guarantees a valid hub
 * session before anything here renders; the session is read again only to show
 * which hub is signed in.
 */
export default async function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-9 w-9 flex-none place-items-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm">
              B
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-accent" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-foreground">
                BENMP Partners
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Hub workspace
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <span className="rounded-full border border-brand/15 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand">
                Hub {session.hubNumber}
              </span>
            )}
            <HubSignOut />
          </div>
        </div>
      </header>
      {session && !session.mustChange && <HubNav />}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
