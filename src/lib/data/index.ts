import { MockPrmRepository } from "./mock-prm-repository";
import type { DataProvider, PrmRepository } from "./types";

function getDataProvider(): DataProvider {
  const provider = process.env.BENMP_DATA_PROVIDER;

  if (provider === "supabase" || provider === "postgres") {
    return provider;
  }

  return "mock";
}

export function getPrmRepository(): PrmRepository {
  const provider = getDataProvider();

  if (provider === "mock") {
    return new MockPrmRepository();
  }

  // The UI is now repository-driven. A Supabase/Postgres implementation only
  // needs to satisfy PrmRepository; pages should not change when it is added.
  return new MockPrmRepository();
}

export async function getDashboardOverview() {
  return getPrmRepository().getOverview();
}

export async function getPartnersView() {
  return getPrmRepository().getPartnersView();
}

export async function getGivingView() {
  return getPrmRepository().getGivingView();
}

export async function getCommunicationView() {
  return getPrmRepository().getCommunicationView();
}

export async function getFollowUpView() {
  return getPrmRepository().getFollowUpView();
}

export async function getCampaignsView() {
  return getPrmRepository().getCampaignsView();
}

export async function getPrayerView() {
  return getPrmRepository().getPrayerView();
}

export async function getAiOperationsView() {
  return getPrmRepository().getAiOperationsView();
}

export async function getAdminView() {
  return getPrmRepository().getAdminView();
}

export type {
  AdminViewData,
  AiOperationsViewData,
  AiWorkflow,
  CampaignRecord,
  CampaignsViewData,
  CampaignStatus,
  CommunicationChannel,
  CommunicationSegment,
  CommunicationViewData,
  ContributionRecord,
  CountrySummary,
  DashboardMetric,
  DashboardOverview,
  DataProvider,
  DataReadinessItem,
  FollowUpTask,
  FollowUpViewData,
  GivingTrendPoint,
  GivingViewData,
  MessageBatch,
  MessageStatus,
  MetricTone,
  MoneyAmount,
  NavIconKey,
  NavItem,
  PartnerRecord,
  PartnerStatus,
  PartnersViewData,
  PaymentImportBatch,
  PrayerRequestRecord,
  PrayerViewData,
  PrmRepository,
  ProviderStatus,
  StaffRole,
  TaskStatus,
} from "./types";
