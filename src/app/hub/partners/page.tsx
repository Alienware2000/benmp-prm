import { cookies } from "next/headers";
import {
  HUB_SESSION_COOKIE,
  hubSessionSecret,
  verifyHubSessionToken,
} from "@/lib/hub/session";
import {
  getHubPartners,
  getHubUploads,
  getRegionCollectsPledge,
  getRegionMomoRequired,
} from "@/lib/hub/db";
import { PartnersTable } from "./partners-table";
import { RemovedList } from "./removed-list";

export const dynamic = "force-dynamic";

/**
 * Read view of everything this hub has uploaded (HP-4). Hub-scoped by the
 * session — a hub can never list another hub's people.
 */
export default async function HubPartnersPage() {
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
  const collectsPledge = await getRegionCollectsPledge(session.regionCode);
  const [everyone, uploads, momoRequired] = await Promise.all([
    getHubPartners(session.hubId, collectsPledge),
    getHubUploads(session.hubId),
    getRegionMomoRequired(session.regionCode),
  ]);
  const partners = everyone.filter((p) => !p.removed_at);
  const removed = everyone.filter((p) => p.removed_at);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your partners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone {session.hubLabel} has uploaded:{" "}
          {partners.length === 0
            ? "none yet. Use the Upload tab to add your first list."
            : `${partners.length} ${partners.length === 1 ? "person" : "people"}.`}
        </p>
      </div>
      {partners.length > 0 && (
        <PartnersTable
          partners={partners}
          uploads={uploads}
          showMomo={momoRequired}
          showPledge={collectsPledge}
        />
      )}
      {removed.length > 0 && (
        <RemovedList
          removed={removed.map((p) => ({
            id: p.id,
            name: p.full_name,
            church: p.church,
            removedAt: p.removed_at!,
          }))}
        />
      )}
    </div>
  );
}
