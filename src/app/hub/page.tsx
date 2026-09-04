import { cookies } from "next/headers";
import { ChevronDown, Church, Users } from "lucide-react";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import {
  findHubPartnerNames,
  getHubChurches,
  getHubSummary,
} from "@/lib/hub/db";
import { IngestWizard } from "./ingest-wizard";

export const dynamic = "force-dynamic";

/**
 * Hub home: the upload wizard front and center ("upon log in the page should
 * just have the upload box" — Decision 0018), with the hub's numbers beneath.
 */
export default async function HubHomePage() {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  const [summary, churches, existingPartners] = session
    ? await Promise.all([
        getHubSummary(session.hubId),
        getHubChurches(session.hubId),
        // Names of partners this hub already has, so the preview can say which rows
        // will update an existing person rather than add a new one.
        findHubPartnerNames(session.hubId),
      ])
    : [null, [], []];

  if (!session || !summary) {
    // The proxy should make this unreachable; fail soft rather than crash.
    return (
      <p className="text-sm text-muted-foreground">
        Could not load this hub. Sign out and back in, or contact the BENMP
        office.
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

      <IngestWizard
        hubId={session.hubId}
        existingPartners={existingPartners}
        churches={churches.map((c) => ({
          id: c.id,
          name: c.name,
          nameKey: c.name_key,
        }))}
      />

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

      <details className="group rounded-lg border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Your hub&apos;s approved church list
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Church names in your uploads must match one of these — open the
              list to check your spreadsheet before uploading.
            </p>
          </div>
          <ChevronDown
            className="h-4 w-4 flex-none text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-t border-border px-5 py-4">
          <ul className="flex flex-wrap gap-1.5">
            {churches.map((c) => (
              <li
                key={c.id}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
              >
                {c.name}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
