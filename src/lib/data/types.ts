import type { ComponentType } from "react";

export type IconComponent = ComponentType<{ className?: string }>;

export type DataProvider = "mock" | "supabase" | "postgres";

export type NavIconKey =
  | "overview"
  | "partners"
  | "giving"
  | "communication"
  | "followUp"
  | "campaigns"
  | "prayer"
  | "ai"
  | "admin";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconKey;
}

export type MetricTone =
  "blue" | "emerald" | "amber" | "violet" | "rose" | "slate";

export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
  icon: IconComponent;
}

export interface MoneyAmount {
  amountMinor: number;
  currency: string;
}

export type CommunicationChannel =
  "WhatsApp" | "SMS" | "Email" | "Phone" | "None";

export type PartnerStatus =
  | "New"
  | "Active"
  | "Needs follow-up"
  | "Paused"
  | "Inactive"
  | "Do not contact";

export type TaskStatus = "Open" | "In progress" | "Review" | "Done";

export type MessageStatus =
  "Draft" | "Review" | "Queued" | "Scheduled" | "Sent" | "Failed";

export type CampaignStatus = "Planning" | "Preparing" | "Live" | "Reporting";

export interface GivingTrendPoint {
  month: string;
  amount: MoneyAmount;
}

export interface PartnerRecord {
  id: string;
  fullName: string;
  mobileNumber: string;
  whatsappNumber: string;
  email: string;
  country: string;
  city: string;
  church: string;
  partnerSince: string;
  partnershipLevel: string;
  givingFrequency: string;
  preferredCommunication: CommunicationChannel;
  status: PartnerStatus;
  owner: string;
  lifetimeGiving: MoneyAmount;
  lastContributionDate: string;
  lastContactedAt: string;
  prayerSummary: string;
  notes: string;
  tags: string[];
}

export interface ContributionRecord {
  id: string;
  contributionDate: string;
  partnerId: string;
  partnerName: string;
  amount: MoneyAmount;
  paymentMethod: string;
  campaignName: string;
  provider: string;
  providerReference: string;
  status: "Succeeded" | "Pending" | "Failed" | "Review";
  reconciliationStatus: "Matched" | "Probable" | "Unmatched";
}

export interface PaymentImportBatch {
  id: string;
  provider: string;
  fileName: string;
  importedAt: string;
  status: "Ready" | "Review" | "Partial" | "Failed";
  rowCount: number;
  matchedCount: number;
  ambiguousCount: number;
  owner: string;
}

export interface FollowUpTask {
  id: string;
  partnerName: string;
  country: string;
  reason: string;
  owner: string;
  channel: CommunicationChannel;
  priority: "High" | "Medium" | "Low";
  status: TaskStatus;
  dueOn: string;
  source: string;
  nextAction: string;
}

export interface CampaignRecord {
  id: string;
  name: string;
  country: string;
  city: string;
  dates: string;
  status: CampaignStatus;
  partnerCount: number;
  fundingGoal: MoneyAmount;
  raised: MoneyAmount;
  reportStatus: "Not started" | "Draft" | "Review" | "Ready";
  nextUpdate: string;
}

export interface CommunicationSegment {
  id: string;
  name: string;
  description: string;
  channel: CommunicationChannel;
  recipientCount: number;
  criteria: string[];
  complianceStatus: "Ready" | "Needs review";
  owner: string;
}

export interface MessageBatch {
  id: string;
  name: string;
  segmentName: string;
  channel: CommunicationChannel;
  recipientCount: number;
  status: MessageStatus;
  templateStatus: "Approved" | "Needs review" | "Not required";
  approvalOwner: string;
  scheduledFor: string;
}

export interface PrayerRequestRecord {
  id: string;
  partnerName: string;
  country: string;
  request: string;
  owner: string;
  status: "Open" | "Praying" | "Responded" | "Sensitive";
  sensitivity: "Standard" | "Restricted";
  createdAt: string;
  nextAction: string;
}

export interface CountrySummary {
  country: string;
  partners: number;
  monthlyPartners: number;
  giving: MoneyAmount;
  openFollowUps: number;
  primaryChannel: CommunicationChannel;
}

export interface DataReadinessItem {
  label: string;
  status: "Ready" | "Needs setup" | "Planned";
  detail: string;
}

export interface ProviderStatus {
  name: string;
  providerKey: string;
  status: "Active" | "Configured" | "Needs setup" | "Planned";
  detail: string;
}

export interface StaffRole {
  role: string;
  scope: string;
  status: "Ready" | "Planned";
}

export interface AiWorkflow {
  name: string;
  purpose: string;
  riskLevel: "Read-only" | "Draft" | "Mutation";
  status: "Ready" | "Needs setup" | "Blocked";
  approvalPolicy: string;
}

export interface DashboardOverview {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  givingTrend: GivingTrendPoint[];
  priorities: FollowUpTask[];
  countrySummaries: CountrySummary[];
  dataReadiness: DataReadinessItem[];
  campaigns: CampaignRecord[];
  partnerRows: PartnerRecord[];
}

export interface PartnersViewData {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  partners: PartnerRecord[];
  segments: CommunicationSegment[];
  onboardingChecklist: DataReadinessItem[];
}

export interface GivingViewData {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  contributions: ContributionRecord[];
  imports: PaymentImportBatch[];
  followUpTriggers: DataReadinessItem[];
}

export interface CommunicationViewData {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  segments: CommunicationSegment[];
  batches: MessageBatch[];
  providers: ProviderStatus[];
  approvalChecklist: DataReadinessItem[];
}

export interface FollowUpViewData {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  tasks: FollowUpTask[];
  outcomes: DataReadinessItem[];
}

export interface CampaignsViewData {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  campaigns: CampaignRecord[];
  reportQueue: MessageBatch[];
}

export interface PrayerViewData {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  requests: PrayerRequestRecord[];
  queues: DataReadinessItem[];
}

export interface AiOperationsViewData {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  workflows: AiWorkflow[];
  guardrails: DataReadinessItem[];
  providers: ProviderStatus[];
}

export interface AdminViewData {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  roles: StaffRole[];
  providers: ProviderStatus[];
  backendReadiness: DataReadinessItem[];
}

export interface PrmRepository {
  getOverview(): Promise<DashboardOverview>;
  getPartnersView(): Promise<PartnersViewData>;
  getGivingView(): Promise<GivingViewData>;
  getCommunicationView(): Promise<CommunicationViewData>;
  getFollowUpView(): Promise<FollowUpViewData>;
  getCampaignsView(): Promise<CampaignsViewData>;
  getPrayerView(): Promise<PrayerViewData>;
  getAiOperationsView(): Promise<AiOperationsViewData>;
  getAdminView(): Promise<AdminViewData>;
}
