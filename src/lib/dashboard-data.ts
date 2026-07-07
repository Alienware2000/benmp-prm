import {
  Bot,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Globe2,
  HeartHandshake,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";

export const navItems = [
  { label: "Overview", href: "/", icon: TrendingUp },
  { label: "Partners", href: "/partners", icon: UsersRound },
  { label: "Giving", href: "/giving", icon: CircleDollarSign },
  { label: "Communication", href: "/communication", icon: MessageCircle },
  { label: "Follow-up", href: "/follow-up", icon: ClipboardList },
  { label: "Campaigns", href: "/campaigns", icon: Globe2 },
  { label: "Prayer", href: "/prayer", icon: HeartHandshake },
  { label: "AI Assist", href: "/ai", icon: Bot },
  { label: "Admin", href: "/admin", icon: ShieldCheck },
];

export const metrics = [
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
];

export const givingTrend = [
  { month: "Feb", amount: 118000 },
  { month: "Mar", amount: 132500 },
  { month: "Apr", amount: 151800 },
  { month: "May", amount: 143200 },
  { month: "Jun", amount: 174600 },
  { month: "Jul", amount: 186240 },
];

export const segments = [
  {
    name: "Ghana monthly partners",
    count: 3240,
    channel: "WhatsApp",
    intent: "Monthly appreciation",
  },
  {
    name: "Missed 60 days",
    count: 428,
    channel: "SMS + call",
    intent: "Gentle follow-up",
  },
  {
    name: "Major partners",
    count: 94,
    channel: "Email",
    intent: "Campaign report",
  },
  {
    name: "New partners",
    count: 326,
    channel: "WhatsApp",
    intent: "Welcome sequence",
  },
];

export const followUps = [
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
];

export const campaigns = [
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
];

export const partnerRows = [
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
];

export const aiWorkflows = [
  {
    title: "Partner briefing",
    description:
      "Summarize giving, notes, prayer requests, and recent communication before a call.",
    readiness: "After partner profiles",
    icon: Sparkles,
  },
  {
    title: "Segment builder",
    description:
      "Turn natural language into safe, reviewable partner filters and task queues.",
    readiness: "After segmentation",
    icon: UsersRound,
  },
  {
    title: "Donation reconciliation",
    description:
      "Match Paystack exports to partners and flag ambiguous rows for staff review.",
    readiness: "After imports",
    icon: CircleDollarSign,
  },
  {
    title: "Crusade update drafts",
    description:
      "Draft WhatsApp, SMS, and email variants from campaign reports and testimonies.",
    readiness: "After templates",
    icon: CalendarClock,
  },
];
