import { MockDashboardRepository } from "./mock-dashboard-repository";
import type { DashboardRepository, DataProvider } from "./types";

function getDataProvider(): DataProvider {
  const provider = process.env.BENMP_DATA_PROVIDER;

  if (provider === "supabase" || provider === "postgres") {
    return provider;
  }

  return "mock";
}

export function getDashboardRepository(): DashboardRepository {
  const provider = getDataProvider();

  if (provider === "mock") {
    return new MockDashboardRepository();
  }

  // Keep the MVP database-free. These providers can be added once BENMP
  // confirms operational data fields and hosting requirements.
  return new MockDashboardRepository();
}

export async function getDashboardOverview() {
  return getDashboardRepository().getOverview();
}

export type {
  CampaignSummary,
  DashboardMetric,
  DashboardOverview,
  DashboardRepository,
  DataProvider,
  FollowUpItem,
  GivingTrendPoint,
  NavIconKey,
  NavItem,
  PartnerSnapshotRow,
} from "./types";
