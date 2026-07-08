import {
  Bot,
  CircleDollarSign,
  ClipboardList,
  Database,
  Globe2,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type {
  AdminViewData,
  AiOperationsViewData,
  CampaignRecord,
  CampaignsViewData,
  CommunicationSegment,
  CommunicationViewData,
  ContributionRecord,
  CountrySummary,
  DashboardMetric,
  DashboardOverview,
  DataReadinessItem,
  FollowUpTask,
  FollowUpViewData,
  GivingTrendPoint,
  GivingViewData,
  MessageBatch,
  NavItem,
  PartnerRecord,
  PartnersViewData,
  PaymentImportBatch,
  PrayerRequestRecord,
  PrayerViewData,
  PrmRepository,
  ProviderStatus,
  StaffRole,
  AiWorkflow,
} from "./types";

const navItems: NavItem[] = [
  { label: "Today", href: "/", icon: "overview" },
  { label: "Partners", href: "/partners", icon: "partners" },
  { label: "Giving", href: "/giving", icon: "giving" },
  { label: "Reports", href: "/reports", icon: "reports" },
  { label: "Communication", href: "/communication", icon: "communication" },
  { label: "Follow-up", href: "/follow-up", icon: "followUp" },
  { label: "Campaigns", href: "/campaigns", icon: "campaigns" },
  { label: "Prayer", href: "/prayer", icon: "prayer" },
  { label: "AI Assist", href: "/ai", icon: "ai" },
  { label: "Admin", href: "/admin", icon: "admin" },
];

const overviewMetrics: DashboardMetric[] = [
  {
    label: "Gifts Today",
    value: "26",
    detail: "MoMo, card, and bank",
    tone: "amber",
    icon: CircleDollarSign,
  },
  {
    label: "Thank-yous Sent",
    value: "24",
    detail: "2 need staff review",
    tone: "emerald",
    icon: MessageCircle,
  },
  {
    label: "High Touch Gifts",
    value: "4",
    detail: "$100+ or local equivalent",
    tone: "violet",
    icon: UsersRound,
  },
  {
    label: "Care Calls",
    value: "42",
    detail: "Due today",
    tone: "rose",
    icon: ClipboardList,
  },
];

const givingTrend: GivingTrendPoint[] = [
  { month: "Feb", amount: { amountMinor: 11800000, currency: "USD" } },
  { month: "Mar", amount: { amountMinor: 13250000, currency: "USD" } },
  { month: "Apr", amount: { amountMinor: 15180000, currency: "USD" } },
  { month: "May", amount: { amountMinor: 14320000, currency: "USD" } },
  { month: "Jun", amount: { amountMinor: 17460000, currency: "USD" } },
  { month: "Jul", amount: { amountMinor: 18624000, currency: "USD" } },
];

const partners: PartnerRecord[] = [
  {
    id: "partner_ama_serwaa",
    fullName: "Ama Serwaa",
    mobileNumber: "+233 24 555 0181",
    whatsappNumber: "+233 24 555 0181",
    email: "ama.serwaa@example.org",
    country: "Ghana",
    city: "Accra",
    church: "Qodesh Family Church",
    partnerSince: "Jan 12, 2023",
    partnershipLevel: "Monthly",
    givingFrequency: "Monthly",
    preferredCommunication: "WhatsApp",
    status: "Active",
    owner: "Ghana coordinator",
    lifetimeGiving: { amountMinor: 482000, currency: "USD" },
    lastContributionDate: "Jul 2, 2026",
    lastContactedAt: "Jun 28, 2026",
    prayerSummary: "Children's education and family health.",
    notes: "Faithful monthly partner. Prefers short testimony updates.",
    tags: ["Ghana", "Monthly", "WhatsApp"],
  },
  {
    id: "partner_daniel_okafor",
    fullName: "Daniel Okafor",
    mobileNumber: "+234 80 5555 0812",
    whatsappNumber: "+234 80 5555 0812",
    email: "daniel.okafor@example.org",
    country: "Nigeria",
    city: "Lagos",
    church: "First Love Church Lagos",
    partnerSince: "Mar 4, 2021",
    partnershipLevel: "Major",
    givingFrequency: "Quarterly",
    preferredCommunication: "Email",
    status: "Active",
    owner: "Major partners team",
    lifetimeGiving: { amountMinor: 2850000, currency: "USD" },
    lastContributionDate: "Jun 28, 2026",
    lastContactedAt: "Jun 30, 2026",
    prayerSummary: "Wisdom around a business expansion.",
    notes: "Responds well to detailed campaign reports and finance clarity.",
    tags: ["Major", "Nigeria", "Report"],
  },
  {
    id: "partner_marie_nguessan",
    fullName: "Marie N'Guessan",
    mobileNumber: "+225 07 55 55 0188",
    whatsappNumber: "+225 07 55 55 0188",
    email: "marie.nguessan@example.org",
    country: "Cote d'Ivoire",
    city: "Abidjan",
    church: "Lighthouse Chapel Abidjan",
    partnerSince: "Sep 19, 2024",
    partnershipLevel: "Quarterly",
    givingFrequency: "Quarterly",
    preferredCommunication: "SMS",
    status: "Needs follow-up",
    owner: "Francophone coordinator",
    lifetimeGiving: { amountMinor: 126000, currency: "USD" },
    lastContributionDate: "Apr 20, 2026",
    lastContactedAt: "May 7, 2026",
    prayerSummary: "Requested prayer for her mother.",
    notes: "Quarterly partner. Needs gentle follow-up before Assomada appeal.",
    tags: ["Francophone", "SMS", "Follow-up"],
  },
  {
    id: "partner_samuel_tetteh",
    fullName: "Samuel Tetteh",
    mobileNumber: "+1 214 555 0144",
    whatsappNumber: "+1 214 555 0144",
    email: "samuel.tetteh@example.org",
    country: "United States",
    city: "Dallas",
    church: "Lighthouse Chapel International Dallas",
    partnerSince: "Jun 12, 2026",
    partnershipLevel: "Prayer",
    givingFrequency: "Irregular",
    preferredCommunication: "Phone",
    status: "New",
    owner: "North America coordinator",
    lifetimeGiving: { amountMinor: 60000, currency: "USD" },
    lastContributionDate: "Jun 12, 2026",
    lastContactedAt: "Not yet contacted",
    prayerSummary: "Direction about joining the prayer partner team.",
    notes: "Needs welcome call and orientation to recurring partnership.",
    tags: ["New", "Prayer", "Phone"],
  },
  {
    id: "partner_angela_boateng",
    fullName: "Angela Boateng",
    mobileNumber: "+44 7700 900181",
    whatsappNumber: "+44 7700 900181",
    email: "angela.boateng@example.org",
    country: "United Kingdom",
    city: "London",
    church: "Lighthouse Chapel London",
    partnerSince: "Nov 2, 2022",
    partnershipLevel: "Monthly",
    givingFrequency: "Monthly",
    preferredCommunication: "Email",
    status: "Active",
    owner: "Europe coordinator",
    lifetimeGiving: { amountMinor: 314000, currency: "USD" },
    lastContributionDate: "Jul 1, 2026",
    lastContactedAt: "Jun 18, 2026",
    prayerSummary: "Family healing and encouragement.",
    notes: "Prayer request is awaiting response from prayer team.",
    tags: ["Europe", "Monthly", "Prayer"],
  },
];

const contributions: ContributionRecord[] = [
  {
    id: "gift_momo_10501",
    contributionDate: "Jul 8, 2026",
    partnerId: "partner_ama_serwaa",
    partnerName: "Ama Serwaa",
    amount: { amountMinor: 60000, currency: "GHS" },
    paymentMethod: "MTN Mobile Money",
    campaignName: "Banjul",
    provider: "Flutterwave",
    providerReference: "FLW-MOMO-10501",
    status: "Succeeded",
    reconciliationStatus: "Matched",
    acknowledgementStatus: "Sent",
    attentionTier: "Active year covered",
    annualCoverageMonths: 12,
    followUpRequired: true,
  },
  {
    id: "gift_momo_10502",
    contributionDate: "Jul 8, 2026",
    partnerId: "partner_daniel_okafor",
    partnerName: "Daniel Okafor",
    amount: { amountMinor: 120000, currency: "GHS" },
    paymentMethod: "Mobile Money",
    campaignName: "Banjul",
    provider: "Hubtel",
    providerReference: "HUB-MOMO-10502",
    status: "Succeeded",
    reconciliationStatus: "Matched",
    acknowledgementStatus: "Drafted",
    attentionTier: "High touch",
    annualCoverageMonths: 24,
    followUpRequired: true,
  },
  {
    id: "gift_card_10503",
    contributionDate: "Jul 8, 2026",
    partnerId: "partner_angela_boateng",
    partnerName: "Angela Boateng",
    amount: { amountMinor: 6000, currency: "USD" },
    paymentMethod: "Card",
    campaignName: "General",
    provider: "Paystack",
    providerReference: "PAY-CARD-10503",
    status: "Succeeded",
    reconciliationStatus: "Matched",
    acknowledgementStatus: "Sent",
    attentionTier: "Active year covered",
    annualCoverageMonths: 12,
    followUpRequired: true,
  },
  {
    id: "gift_bank_10504",
    contributionDate: "Jul 7, 2026",
    partnerId: "partner_marie_nguessan",
    partnerName: "Marie N'Guessan",
    amount: { amountMinor: 4000000, currency: "XOF" },
    paymentMethod: "Mobile Money",
    campaignName: "Assomada",
    provider: "Paystack",
    providerReference: "PAY-CIV-10504",
    status: "Review",
    reconciliationStatus: "Probable",
    acknowledgementStatus: "Pending",
    attentionTier: "Standard",
    annualCoverageMonths: 8,
    followUpRequired: false,
  },
];

const imports: PaymentImportBatch[] = [
  {
    id: "import_flutterwave_momo_july_8",
    provider: "Flutterwave",
    fileName: "flutterwave-momo-july-8.csv",
    importedAt: "Jul 8, 2026 11:18",
    status: "Review",
    rowCount: 26,
    matchedCount: 23,
    ambiguousCount: 3,
    owner: "Finance",
  },
  {
    id: "import_hubtel_momo_july_8",
    provider: "Hubtel",
    fileName: "hubtel-momo-july-8.csv",
    importedAt: "Jul 8, 2026 10:52",
    status: "Ready",
    rowCount: 18,
    matchedCount: 18,
    ambiguousCount: 0,
    owner: "Finance",
  },
  {
    id: "import_bank_july_7",
    provider: "Bank transfer",
    fileName: "bank-transfer-july-7.csv",
    importedAt: "Jul 7, 2026 16:30",
    status: "Partial",
    rowCount: 9,
    matchedCount: 6,
    ambiguousCount: 3,
    owner: "Finance",
  },
];

const tasks: FollowUpTask[] = [
  {
    id: "task_daniel_high_touch",
    partnerName: "Daniel Okafor",
    country: "Ghana",
    reason: "High-touch donor call",
    owner: "Major partners team",
    channel: "Phone",
    priority: "High",
    status: "Open",
    dueOn: "Today",
    source: "$100+ equivalent gift",
    nextAction:
      "Call personally, thank him, and confirm preferred crusade updates.",
  },
  {
    id: "task_ama_active_year",
    partnerName: "Ama Serwaa",
    country: "Ghana",
    reason: "Annual BENMP covered",
    owner: "Ghana coordinator",
    channel: "WhatsApp",
    priority: "High",
    status: "Open",
    dueOn: "Today",
    source: "$60 annual equivalent reached",
    nextAction: "Send warm thank-you and mark her active for the BENMP year.",
  },
  {
    id: "task_angela_card_thanks",
    partnerName: "Angela Boateng",
    country: "United Kingdom",
    reason: "Annual gift acknowledgement",
    owner: "Europe coordinator",
    channel: "Email",
    priority: "Medium",
    status: "In progress",
    dueOn: "Tomorrow",
    source: "Card donation",
    nextAction:
      "Send personalized annual thank-you and offer WhatsApp updates.",
  },
  {
    id: "task_marie_momo_review",
    partnerName: "Marie N'Guessan",
    country: "Cote d'Ivoire",
    reason: "MoMo match review",
    owner: "Finance",
    channel: "SMS",
    priority: "Medium",
    status: "Review",
    dueOn: "Jul 9",
    source: "Probable payment match",
    nextAction:
      "Confirm MoMo reference before sending the acknowledgement message.",
  },
];

const campaigns: CampaignRecord[] = [
  {
    id: "campaign_banjul_2026",
    name: "Healing Jesus Campaign Banjul",
    country: "The Gambia",
    city: "Banjul",
    dates: "Jul 7-10, 2026",
    status: "Live",
    partnerCount: 1120,
    fundingGoal: { amountMinor: 24000000, currency: "USD" },
    raised: { amountMinor: 17280000, currency: "USD" },
    reportStatus: "Draft",
    nextUpdate: "Nightly report due 10:00 PM",
  },
  {
    id: "campaign_assomada_2026",
    name: "Healing Jesus Campaign Assomada",
    country: "Cape Verde",
    city: "Assomada",
    dates: "Jul 15-17, 2026",
    status: "Preparing",
    partnerCount: 740,
    fundingGoal: { amountMinor: 16000000, currency: "USD" },
    raised: { amountMinor: 7680000, currency: "USD" },
    reportStatus: "Not started",
    nextUpdate: "Pre-crusade appeal draft due Jul 10",
  },
  {
    id: "campaign_gtwc_2026",
    name: "Give Thyself Wholly Conference",
    country: "Ghana",
    city: "Accra",
    dates: "Aug 4-7, 2026",
    status: "Preparing",
    partnerCount: 510,
    fundingGoal: { amountMinor: 12000000, currency: "USD" },
    raised: { amountMinor: 4680000, currency: "USD" },
    reportStatus: "Review",
    nextUpdate: "Coordinator update due Jul 12",
  },
];

const segments: CommunicationSegment[] = [
  {
    id: "segment_today_momo_thanks",
    name: "Today MoMo donors",
    description: "Donors whose mobile money gift was received today.",
    channel: "WhatsApp",
    recipientCount: 24,
    criteria: ["Gift today", "MoMo source", "WhatsApp or mobile present"],
    complianceStatus: "Ready",
    owner: "Communications",
  },
  {
    id: "segment_active_year",
    name: "Active for the year",
    description: "Partners who have reached the $60 annual BENMP equivalent.",
    channel: "WhatsApp",
    recipientCount: 1312,
    criteria: ["Annual coverage is 12 months", "Do not contact is false"],
    complianceStatus: "Ready",
    owner: "Partner care",
  },
  {
    id: "segment_high_touch",
    name: "High-touch donors",
    description: "Donors above the board-defined personal-care threshold.",
    channel: "Email",
    recipientCount: 94,
    criteria: ["Gift above threshold", "Call required", "Report eligible"],
    complianceStatus: "Needs review",
    owner: "Major partners team",
  },
];

const batches: MessageBatch[] = [
  {
    id: "batch_today_momo_thanks",
    name: "Today MoMo Thank-you",
    segmentName: "Today MoMo donors",
    channel: "WhatsApp",
    recipientCount: 24,
    status: "Review",
    templateStatus: "Needs review",
    approvalOwner: "Communications lead",
    scheduledFor: "Jul 8, 2026 12:00",
  },
  {
    id: "batch_high_touch_report",
    name: "High-touch Campaign Report",
    segmentName: "High-touch donors",
    channel: "Email",
    recipientCount: 94,
    status: "Queued",
    templateStatus: "Not required",
    approvalOwner: "Major partners lead",
    scheduledFor: "Jul 11, 2026 08:00",
  },
  {
    id: "batch_active_year_welcome",
    name: "Active Year Appreciation",
    segmentName: "Active for the year",
    channel: "WhatsApp",
    recipientCount: 1312,
    status: "Sent",
    templateStatus: "Approved",
    approvalOwner: "Communications lead",
    scheduledFor: "Sent Jul 1",
  },
];

const prayers: PrayerRequestRecord[] = [
  {
    id: "prayer_angela",
    partnerName: "Angela Boateng",
    country: "United Kingdom",
    request: "Family healing and encouragement",
    owner: "Prayer team",
    status: "Open",
    sensitivity: "Standard",
    createdAt: "Jul 1, 2026",
    nextAction: "Send approved prayer response.",
  },
  {
    id: "prayer_samuel",
    partnerName: "Samuel Tetteh",
    country: "United States",
    request: "New business and ministry direction",
    owner: "Coordinator",
    status: "Praying",
    sensitivity: "Standard",
    createdAt: "Jun 29, 2026",
    nextAction: "Coordinator follow-up call.",
  },
  {
    id: "prayer_ama",
    partnerName: "Ama Serwaa",
    country: "Ghana",
    request: "Thanksgiving after answered prayer",
    owner: "Prayer team",
    status: "Responded",
    sensitivity: "Standard",
    createdAt: "Jun 24, 2026",
    nextAction: "Consider testimony candidate.",
  },
  {
    id: "prayer_private",
    partnerName: "Private partner",
    country: "Nigeria",
    request: "Sensitive pastoral request",
    owner: "Senior pastor",
    status: "Sensitive",
    sensitivity: "Restricted",
    createdAt: "Jul 2, 2026",
    nextAction: "Restricted pastoral handoff.",
  },
];

const countrySummaries: CountrySummary[] = [
  {
    country: "Ghana",
    partners: 4210,
    monthlyPartners: 3240,
    giving: { amountMinor: 7240000, currency: "USD" },
    openFollowUps: 38,
    primaryChannel: "WhatsApp",
  },
  {
    country: "Nigeria",
    partners: 1680,
    monthlyPartners: 914,
    giving: { amountMinor: 3840000, currency: "USD" },
    openFollowUps: 27,
    primaryChannel: "Email",
  },
  {
    country: "United Kingdom",
    partners: 830,
    monthlyPartners: 420,
    giving: { amountMinor: 1920000, currency: "USD" },
    openFollowUps: 12,
    primaryChannel: "Email",
  },
  {
    country: "Cote d'Ivoire",
    partners: 540,
    monthlyPartners: 188,
    giving: { amountMinor: 680000, currency: "USD" },
    openFollowUps: 31,
    primaryChannel: "SMS",
  },
];

const backendReadiness: DataReadinessItem[] = [
  {
    label: "Repository contract",
    status: "Ready",
    detail: "Pages consume typed PRM views, not hard-coded page arrays.",
  },
  {
    label: "Postgres schema",
    status: "Ready",
    detail:
      "Migration covers partners, giving, messages, tasks, prayer, audit.",
  },
  {
    label: "Authentication",
    status: "Needs setup",
    detail: "Connect Supabase Auth, Clerk, or Auth.js before real staff data.",
  },
  {
    label: "Provider credentials",
    status: "Needs setup",
    detail:
      "WhatsApp, SMS, email, and payment providers require board decision.",
  },
];

const providerStatuses: ProviderStatus[] = [
  {
    name: "Mock repository",
    providerKey: "mock",
    status: "Active",
    detail: "Seed adapter active for MVP review and UI validation.",
  },
  {
    name: "Flutterwave",
    providerKey: "flutterwave",
    status: "Configured",
    detail:
      "Best near-term fit for MoMo-led test intake, cards, webhooks, and provider references.",
  },
  {
    name: "Hubtel",
    providerKey: "hubtel",
    status: "Planned",
    detail:
      "Strong Ghana MoMo option across local networks; useful if BENMP wants Ghana-first settlement and operations.",
  },
  {
    name: "Paystack",
    providerKey: "paystack",
    status: "Planned",
    detail:
      "Useful for cards, bank transfer, Ghana DVA, and regional mobile money coverage.",
  },
  {
    name: "Supabase/Postgres",
    providerKey: "supabase",
    status: "Needs setup",
    detail:
      "Schema exists; repository implementation can map directly to tables.",
  },
  {
    name: "Twilio",
    providerKey: "twilio",
    status: "Planned",
    detail: "Useful for SMS, WhatsApp pilot, and future voice follow-up.",
  },
  {
    name: "Meta Cloud API",
    providerKey: "meta-cloud-api",
    status: "Planned",
    detail:
      "Best long-term WhatsApp ownership once business account is approved.",
  },
];

const roles: StaffRole[] = [
  {
    role: "Super admin",
    scope: "Full configuration, staff, integrations, and audit access",
    status: "Planned",
  },
  {
    role: "Finance",
    scope: "Giving, imports, failed payments, and reconciliation",
    status: "Planned",
  },
  {
    role: "Communications",
    scope: "Segments, templates, message approvals, and provider queues",
    status: "Planned",
  },
  {
    role: "Regional coordinator",
    scope: "Country-scoped partner records and follow-up tasks",
    status: "Planned",
  },
  {
    role: "Prayer team",
    scope: "Prayer requests and approved care responses",
    status: "Planned",
  },
  {
    role: "Viewer",
    scope: "Read-only dashboards and reports",
    status: "Planned",
  },
];

const aiWorkflows: AiWorkflow[] = [
  {
    name: "Partner briefing",
    purpose:
      "Summarize giving, notes, prayer requests, and recent contact history before a call.",
    riskLevel: "Read-only",
    status: "Ready",
    approvalPolicy: "No data changes; staff uses the brief manually.",
  },
  {
    name: "Segment builder",
    purpose: "Turn plain-language audience requests into reviewable filters.",
    riskLevel: "Draft",
    status: "Needs setup",
    approvalPolicy: "Staff approves saved segments before use.",
  },
  {
    name: "Message drafting",
    purpose: "Draft WhatsApp, SMS, and email variants from campaign reports.",
    riskLevel: "Draft",
    status: "Needs setup",
    approvalPolicy: "No outbound send without staff approval.",
  },
  {
    name: "Payment reconciliation",
    purpose: "Suggest likely matches for imported payment rows.",
    riskLevel: "Draft",
    status: "Needs setup",
    approvalPolicy: "Finance approves before contributions are written.",
  },
  {
    name: "Autonomous sends",
    purpose: "Send messages without human review.",
    riskLevel: "Mutation",
    status: "Blocked",
    approvalPolicy:
      "Blocked until legal, consent, and pastoral policies are approved.",
  },
];

const aiGuardrails: DataReadinessItem[] = [
  {
    label: "Human approval",
    status: "Ready",
    detail: "AI can draft and recommend; staff approves sends and imports.",
  },
  {
    label: "Permission-bound tools",
    status: "Ready",
    detail:
      "AI tools must use the same repository permissions as the staff user.",
  },
  {
    label: "Audit trails",
    status: "Ready",
    detail:
      "Accepted suggestions should become explicit audited staff actions.",
  },
];

export class MockPrmRepository implements PrmRepository {
  async getOverview(): Promise<DashboardOverview> {
    return {
      navItems,
      metrics: overviewMetrics,
      givingTrend,
      priorities: tasks,
      countrySummaries,
      dataReadiness: backendReadiness,
      campaigns,
      partnerRows: partners,
    };
  }

  async getPartnersView(): Promise<PartnersViewData> {
    return {
      navItems,
      metrics: [
        {
          label: "Searchable Partners",
          value: "12,842",
          detail: "Ready for migration",
          tone: "blue",
          icon: UsersRound,
        },
        {
          label: "Monthly Partners",
          value: "7,316",
          detail: "Primary stewardship segment",
          tone: "emerald",
          icon: HeartHandshake,
        },
        {
          label: "Needs Follow-up",
          value: "428",
          detail: "Missed giving or prayer response",
          tone: "amber",
          icon: ClipboardList,
        },
        {
          label: "Major Partners",
          value: "94",
          detail: "High-touch relationship queue",
          tone: "violet",
          icon: UsersRound,
        },
      ],
      partners,
      segments,
      onboardingChecklist: [
        {
          label: "Required identity fields",
          status: "Ready",
          detail: "Name plus at least one channel: WhatsApp, mobile, or email.",
        },
        {
          label: "Consent and opt-out fields",
          status: "Needs setup",
          detail: "Needed before real WhatsApp/SMS sending.",
        },
        {
          label: "CSV import mapping",
          status: "Ready",
          detail: "Fields align with the Postgres partner schema.",
        },
      ],
    };
  }

  async getGivingView(): Promise<GivingViewData> {
    return {
      navItems,
      metrics: [
        {
          label: "Today Intake",
          value: "GHS 942",
          detail: "MoMo-led giving",
          tone: "amber",
          icon: CircleDollarSign,
        },
        {
          label: "Acknowledged",
          value: "24 / 26",
          detail: "Auto thank-you sent",
          tone: "emerald",
          icon: MessageCircle,
        },
        {
          label: "Active Year",
          value: "1,312",
          detail: "$60 equivalent reached",
          tone: "blue",
          icon: HeartHandshake,
        },
        {
          label: "High Touch",
          value: "94",
          detail: "$100+ equivalent",
          tone: "violet",
          icon: UsersRound,
        },
      ],
      contributions,
      imports,
      followUpTriggers: [
        {
          label: "Thank-you after every gift",
          status: "Ready",
          detail:
            "Successful payment webhooks should create an acknowledgement draft or send an approved transactional thank-you.",
        },
        {
          label: "$60 annual active rule",
          status: "Needs setup",
          detail:
            "Any donor reaching $60 or local equivalent should be marked active for the BENMP year.",
        },
        {
          label: "$100 high-touch rule",
          status: "Ready",
          detail:
            "Any donor above the board-defined threshold should enter a personal call and enhanced reporting queue.",
        },
      ],
    };
  }

  async getCommunicationView(): Promise<CommunicationViewData> {
    return {
      navItems,
      metrics: [
        {
          label: "Approval Queue",
          value: "6",
          detail: "Drafts waiting",
          tone: "amber",
          icon: MessageCircle,
        },
        {
          label: "WhatsApp Reach",
          value: "8,420",
          detail: "Partners with WhatsApp",
          tone: "emerald",
          icon: MessageCircle,
        },
        {
          label: "SMS Fallback",
          value: "2,180",
          detail: "Usable mobile numbers",
          tone: "blue",
          icon: MessageCircle,
        },
        {
          label: "Email Reach",
          value: "5,936",
          detail: "Newsletter capable",
          tone: "violet",
          icon: MessageCircle,
        },
      ],
      segments,
      batches,
      providers: providerStatuses.filter((provider) =>
        ["twilio", "meta-cloud-api", "mock"].includes(provider.providerKey),
      ),
      approvalChecklist: [
        {
          label: "Consent check",
          status: "Needs setup",
          detail: "Opt-outs must be removed before real SMS or WhatsApp sends.",
        },
        {
          label: "Template review",
          status: "Needs setup",
          detail: "WhatsApp templates need Meta category approval.",
        },
        {
          label: "Staff approval",
          status: "Ready",
          detail:
            "Batches remain queued until approved by communications staff.",
        },
      ],
    };
  }

  async getFollowUpView(): Promise<FollowUpViewData> {
    return {
      navItems,
      metrics: [
        {
          label: "Open Tasks",
          value: "186",
          detail: "Across all teams",
          tone: "blue",
          icon: ClipboardList,
        },
        {
          label: "High Priority",
          value: "24",
          detail: "Finance and prayer",
          tone: "rose",
          icon: ClipboardList,
        },
        {
          label: "Due Today",
          value: "42",
          detail: "Coordinator queues",
          tone: "amber",
          icon: ClipboardList,
        },
        {
          label: "Completed",
          value: "318",
          detail: "This month",
          tone: "emerald",
          icon: ClipboardList,
        },
      ],
      tasks,
      outcomes: [
        {
          label: "Thanked partner after donation",
          status: "Ready",
          detail: "142 staff-approved care responses completed this month.",
        },
        {
          label: "Prayer responses sent",
          status: "Ready",
          detail: "51 prayer team responses completed this month.",
        },
        {
          label: "Failed gift follow-ups",
          status: "Needs setup",
          detail: "37 finance follow-ups should be converted to owned tasks.",
        },
      ],
    };
  }

  async getCampaignsView(): Promise<CampaignsViewData> {
    return {
      navItems,
      metrics: [
        {
          label: "Active Campaigns",
          value: "3",
          detail: "Live or preparing",
          tone: "emerald",
          icon: Globe2,
        },
        {
          label: "Partner Support",
          value: "2,370",
          detail: "Attached to campaigns",
          tone: "blue",
          icon: UsersRound,
        },
        {
          label: "Reports Due",
          value: "2",
          detail: "For partner updates",
          tone: "amber",
          icon: MessageCircle,
        },
        {
          label: "Countries",
          value: "41",
          detail: "Campaign footprint",
          tone: "violet",
          icon: Globe2,
        },
      ],
      campaigns,
      reportQueue: batches,
    };
  }

  async getPrayerView(): Promise<PrayerViewData> {
    return {
      navItems,
      metrics: [
        {
          label: "Open Requests",
          value: "84",
          detail: "Awaiting prayer team response",
          tone: "blue",
          icon: HeartHandshake,
        },
        {
          label: "Sensitive",
          value: "19",
          detail: "Restricted visibility",
          tone: "rose",
          icon: ShieldCheck,
        },
        {
          label: "Responded",
          value: "51",
          detail: "This month",
          tone: "emerald",
          icon: HeartHandshake,
        },
        {
          label: "Pastoral Follow-up",
          value: "12",
          detail: "Coordinator handoff",
          tone: "amber",
          icon: ClipboardList,
        },
      ],
      requests: prayers,
      queues: [
        {
          label: "Needs response",
          status: "Needs setup",
          detail: "84 requests need prayer team response workflow.",
        },
        {
          label: "Escalate to coordinator",
          status: "Ready",
          detail: "12 pastoral or personal follow-up requests are routed.",
        },
        {
          label: "Answered testimonies",
          status: "Ready",
          detail: "18 requests can be considered for testimony reports.",
        },
      ],
    };
  }

  async getAiOperationsView(): Promise<AiOperationsViewData> {
    return {
      navItems,
      metrics: [
        {
          label: "Read-only Tools",
          value: "1",
          detail: "Safe first phase",
          tone: "emerald",
          icon: Bot,
        },
        {
          label: "Draft Tools",
          value: "3",
          detail: "Require staff review",
          tone: "amber",
          icon: Bot,
        },
        {
          label: "Mutation Tools",
          value: "0",
          detail: "Disabled for MVP",
          tone: "rose",
          icon: ShieldCheck,
        },
        {
          label: "Model Provider",
          value: "Agnostic",
          detail: "AI SDK boundary",
          tone: "violet",
          icon: Database,
        },
      ],
      workflows: aiWorkflows,
      guardrails: aiGuardrails,
      providers: [
        {
          name: "OpenAI",
          providerKey: "openai",
          status: "Planned",
          detail: "Strong default for supervised staff assistant workflows.",
        },
        {
          name: "Anthropic",
          providerKey: "anthropic",
          status: "Planned",
          detail: "Can be added behind the same AI SDK model registry.",
        },
        {
          name: "Local/offline model",
          providerKey: "local",
          status: "Planned",
          detail: "Possible later for sensitive summarization workflows.",
        },
      ],
    };
  }

  async getAdminView(): Promise<AdminViewData> {
    return {
      navItems,
      metrics: [
        {
          label: "Staff Roles",
          value: "6",
          detail: "Permission groups",
          tone: "blue",
          icon: UsersRound,
        },
        {
          label: "Data Provider",
          value: "Mock",
          detail: "Adapter-selected",
          tone: "emerald",
          icon: Database,
        },
        {
          label: "Messaging Provider",
          value: "Mock",
          detail: "No real sends",
          tone: "amber",
          icon: MessageCircle,
        },
        {
          label: "Audit Policy",
          value: "Schema",
          detail: "Audit table drafted",
          tone: "violet",
          icon: ShieldCheck,
        },
      ],
      roles,
      providers: providerStatuses,
      backendReadiness,
    };
  }
}
