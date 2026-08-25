import { cookies } from "next/headers";
import { Church, FileUp, Users } from "lucide-react";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import { getHubSummary } from "@/lib/hub/db";

export const dynamic = "force-dynamic";

/**
 * Hub home (HP-2). For now: who is signed in and the hub's numbers. The
 * upload wizard (HP-3) replaces the placeholder card as the page's centerpiece —
 * "upon log in the page should just have the upload box".
 */
export default async function HubHomePage() {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  const summary = session ? await getHubSummary(session.hubId) : null;

  if (!session || !summary) {
    // The proxy should make this unreachable; fail soft rather than crash.
    return (
      <p className="text-sm text-muted-foreground">
        Could not load this hub. Sign out and back in, or contact the BENMP office.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hub {summary.hubNumber}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Led by {summary.leaderName}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
              <Church className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {summary.churchCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Churches in this hub
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-success/10 text-success">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {summary.partnerCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Partners uploaded by this hub
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-muted text-muted-foreground">
          <FileUp className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="mt-3 text-sm font-semibold text-foreground">
          Partner upload
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          The Excel upload for your hub&apos;s partner lists is being built and
          will appear here. You will be able to upload a file, check every row,
          and correct anything before it is saved.
        </p>
      </div>
    </div>
  );
}
