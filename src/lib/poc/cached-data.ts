import { unstable_cache } from "next/cache";
import { messagingRuntimeConfiguration } from "../messaging/runtime-configuration";
import { loadReconciliation } from "./db";
import { countDirectoryPartners } from "./directory";
import {
  countLegacyGhanaContacts,
  loadLegacyGhanaContacts,
} from "./legacy-contacts";
import { planLegacyBatches } from "./legacy-batches";
import { loadGivingLedger } from "./giving";

/**
 * Read models for the staff workspace. Giving imports are explicit office actions, so a
 * short shared cache is preferable to re-reading thousands of rows on every tab change.
 * Import and edit routes can invalidate the `poc-giving` tag when those flows are added.
 */
export const loadReconciliationCached = unstable_cache(
  () => loadReconciliation(),
  ["poc-reconciliation-v1"],
  { revalidate: 120, tags: ["poc-giving"] },
);

export const loadGivingLedgerCached = unstable_cache(
  () => loadGivingLedger(),
  ["poc-giving-ledger-v2"],
  { revalidate: 120, tags: ["poc-giving"] },
);

export const countDirectoryPartnersCached = unstable_cache(
  () => countDirectoryPartners(),
  ["poc-partner-count-v1"],
  { revalidate: 300, tags: ["poc-partners"] },
);

export const countLegacyGhanaContactsCached = unstable_cache(
  () => countLegacyGhanaContacts(),
  ["poc-legacy-ghana-count-v1"],
  { revalidate: 300, tags: ["poc-legacy-ghana"] },
);

/**
 * The batch table for the legacy Ghana broadcast. Short cache: it changes only when a
 * batch is sent, and a stale count would misreport progress to staff.
 */
export const legacyBatchPlanCached = unstable_cache(
  async () => planLegacyBatches(await loadLegacyGhanaContacts()),
  ["poc-legacy-ghana-batches-v1"],
  { revalidate: 30, tags: ["poc-legacy-ghana"] },
);

export const messagingRuntimeConfigurationCached = unstable_cache(
  () => messagingRuntimeConfiguration(),
  ["poc-messaging-runtime-v1"],
  { revalidate: 30, tags: ["poc-messaging"] },
);
