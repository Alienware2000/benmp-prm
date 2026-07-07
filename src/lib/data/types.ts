import type { ComponentType } from "react";

export type IconComponent = ComponentType<{ className?: string }>;

export type DataProvider = "mock" | "supabase" | "postgres";

export interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
}

export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "emerald" | "amber" | "violet";
  icon: IconComponent;
}

export interface GivingTrendPoint {
  month: string;
  amount: number;
}

export interface FollowUpItem {
  partner: string;
  country: string;
  reason: string;
  channel: string;
  owner: string;
  priority: string;
  icon: IconComponent;
}

export interface CampaignSummary {
  name: string;
  place: string;
  dates: string;
  progress: number;
  partners: number;
  status: "Live" | "Preparing";
}

export interface PartnerSnapshotRow {
  name: string;
  country: string;
  level: string;
  lifetime: string;
  lastGift: string;
  status: "Active" | "Missed" | "New";
}

export interface DashboardOverview {
  navItems: NavItem[];
  metrics: DashboardMetric[];
  givingTrend: GivingTrendPoint[];
  followUps: FollowUpItem[];
  campaigns: CampaignSummary[];
  partnerRows: PartnerSnapshotRow[];
}

export interface DashboardRepository {
  getOverview(): Promise<DashboardOverview>;
}
