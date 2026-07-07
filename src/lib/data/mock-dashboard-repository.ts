import {
  CircleDollarSign,
  Globe2,
  HeartHandshake,
  Mail,
  MessageCircle,
  Phone,
  UsersRound,
} from "lucide-react";
import type { DashboardOverview, DashboardRepository } from "./types";

const overview: DashboardOverview = {
  navItems: [
    { label: "Overview", href: "/", icon: "overview" },
    { label: "Partners", href: "/partners", icon: "partners" },
    { label: "Giving", href: "/giving", icon: "giving" },
    { label: "Communication", href: "/communication", icon: "communication" },
    { label: "Follow-up", href: "/follow-up", icon: "followUp" },
    { label: "Campaigns", href: "/campaigns", icon: "campaigns" },
    { label: "Prayer", href: "/prayer", icon: "prayer" },
    { label: "AI Assist", href: "/ai", icon: "ai" },
    { label: "Admin", href: "/admin", icon: "admin" },
  ],
  metrics: [
    {
      label: "Total Partners",
      value: "12,842",
      detail: "+326 this month",
      tone: "blue",
      icon: UsersRound,
    },
    {
      label: "Active Monthly",
      value: "7,316",
      detail: "57% of all partners",
      tone: "emerald",
      icon: HeartHandshake,
    },
    {
      label: "Monthly Giving",
      value: "$186k",
      detail: "USD equivalent",
      tone: "amber",
      icon: CircleDollarSign,
    },
    {
      label: "Countries",
      value: "41",
      detail: "BENMP represented",
      tone: "violet",
      icon: Globe2,
    },
  ],
  givingTrend: [
    { month: "Feb", amount: 118000 },
    { month: "Mar", amount: 132500 },
    { month: "Apr", amount: 151800 },
    { month: "May", amount: 143200 },
    { month: "Jun", amount: 174600 },
    { month: "Jul", amount: 186240 },
  ],
  followUps: [
    {
      partner: "Pastor Kwame Mensah",
      country: "Ghana",
      reason: "Recurring gift failed",
      channel: "WhatsApp",
      owner: "Finance",
      priority: "High",
      icon: MessageCircle,
    },
    {
      partner: "Angela Boateng",
      country: "United Kingdom",
      reason: "Prayer request awaiting response",
      channel: "Email",
      owner: "Prayer team",
      priority: "Medium",
      icon: Mail,
    },
    {
      partner: "Jean Kouadio",
      country: "Cote d'Ivoire",
      reason: "New partner welcome call",
      channel: "Phone",
      owner: "Regional coordinator",
      priority: "Medium",
      icon: Phone,
    },
  ],
  campaigns: [
    {
      name: "Healing Jesus Campaign Banjul",
      place: "Banjul, The Gambia",
      dates: "Jul 7-10, 2026",
      progress: 72,
      partners: 1120,
      status: "Live",
    },
    {
      name: "Healing Jesus Campaign Assomada",
      place: "Assomada, Cape Verde",
      dates: "Jul 15-17, 2026",
      progress: 48,
      partners: 740,
      status: "Preparing",
    },
    {
      name: "Give Thyself Wholly Conference",
      place: "Anagkazo Campus, Accra",
      dates: "Aug 4-7, 2026",
      progress: 39,
      partners: 510,
      status: "Preparing",
    },
  ],
  partnerRows: [
    {
      name: "Ama Serwaa",
      country: "Ghana",
      level: "Monthly",
      lifetime: "$4,820",
      lastGift: "Jul 2, 2026",
      status: "Active",
    },
    {
      name: "Daniel Okafor",
      country: "Nigeria",
      level: "Major",
      lifetime: "$28,500",
      lastGift: "Jun 28, 2026",
      status: "Active",
    },
    {
      name: "Marie N'Guessan",
      country: "Cote d'Ivoire",
      level: "Quarterly",
      lifetime: "$1,260",
      lastGift: "Apr 20, 2026",
      status: "Missed",
    },
    {
      name: "Samuel Tetteh",
      country: "United States",
      level: "Prayer",
      lifetime: "$600",
      lastGift: "Jun 12, 2026",
      status: "New",
    },
  ],
};

export class MockDashboardRepository implements DashboardRepository {
  async getOverview() {
    return overview;
  }
}
