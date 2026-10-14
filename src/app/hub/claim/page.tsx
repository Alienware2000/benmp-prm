import { cookies } from "next/headers";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import {
  getClaimedByHub,
  getHubChurches,
  getHubCountry,
  getHubSummary,
  getUnassignedGivers,
} from "@/lib/hub/db";
import { buildClaimableGivers } from "@/lib/hub/claim";
import { ClaimList } from "./claim-list";

export const dynamic = "force-dynamic";

/**
 * People who gave but belong to no hub, in this hub's country (Decision 0033).
 * A hub recognises its own members by name, the last 3 phone digits, when they
 * last gave and what they wrote on the payment, and claims them under one of its
 * churches. Phones are masked here, before rendering.
 */
export default async function HubClaimPage() {
  const store = await cookies();
  const session = await verifyHubSessionToken(
    store.get(HUB_SESSION_COOKIE)?.value,
    hubSessionSecret(),
  );
  if (!session) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load this hub. Sign out and back in.
      </p>
    );
  }
  const country = await getHubCountry(session.hubId);
  const [summary, churches, rows, claimed] = await Promise.all([
    getHubSummary(session.hubId),
    getHubChurches(session.hubId),
    getUnassignedGivers(country),
    getClaimedByHub(session.hubId),
  ]);
  const hubName = summary?.hubLabel.replace(/^\d+\s*[—-]\s*/, "") ?? "";
  const givers = buildClaimableGivers(rows, [
    hubName,
    ...churches.map((c) => c.name),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Unclaimed givers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          People in {country} who have given to BENMP but are not on any
          hub&apos;s list. If one of them is your member, claim them under their
          church. Each person can be claimed by one hub only; if someone else
          claimed your member, contact the BENMP office.
        </p>
      </div>
      <ClaimList
        givers={givers}
        churches={churches.map((c) => ({ id: c.id, name: c.name }))}
        claimed={claimed}
      />
    </div>
  );
}
