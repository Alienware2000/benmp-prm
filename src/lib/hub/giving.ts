// src/lib/hub/giving.ts
// What a hub admin's dashboard shows about their own partners' giving. Pure: the
// page loads the hub's partners and the payments matched to them, this decides who
// is active. A partner is ACTIVE if they gave in the current calendar month or the
// two before it, LAPSED if they gave before that but not since, and NEVER GIVEN
// otherwise (Decision 0032).

export type HubGivingPartner = {
  id: string;
  fullName: string;
  phone: string | null;
  church: string | null;
};

export type HubGivingPayment = {
  partnerId: string;
  paidAt: string;
  amountMinor: number;
};

export type GivingStatus = "active" | "lapsed" | "never";

export type HubGivingRow = HubGivingPartner & {
  status: GivingStatus;
  /** ISO timestamp of the most recent gift, or null. */
  lastGiftAt: string | null;
};

export type HubGivingSummary = {
  partnerCount: number;
  activeCount: number;
  lapsedCount: number;
  neverCount: number;
  /** Total given by this hub's partners inside the active window. */
  activeWindowMinor: number;
  /** Total given by this hub's partners this calendar year. */
  yearMinor: number;
  /** First day (YYYY-MM-DD) of the active window. */
  activeSince: string;
  /** Active and lapsed partners, most recent gift first. */
  givers: HubGivingRow[];
};

/** Months, including the current one, that count as "recent" for active status. */
export const ACTIVE_WINDOW_MONTHS = 3;

/** First day of the active window, UTC: the 1st of the month two months back. */
export function activeWindowStart(today: Date): string {
  const start = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() - (ACTIVE_WINDOW_MONTHS - 1),
      1,
    ),
  );
  return start.toISOString().slice(0, 10);
}

export function summarizeHubGiving(
  partners: HubGivingPartner[],
  payments: HubGivingPayment[],
  today: Date,
): HubGivingSummary {
  const activeSince = activeWindowStart(today);
  const yearStart = `${today.getUTCFullYear()}-01-01`;
  const lastGift = new Map<string, string>();
  const ids = new Set(partners.map((p) => p.id));
  let activeWindowMinor = 0;
  let yearMinor = 0;

  for (const payment of payments) {
    if (!ids.has(payment.partnerId)) continue;
    const day = payment.paidAt.slice(0, 10);
    if (day >= activeSince) activeWindowMinor += payment.amountMinor;
    if (day >= yearStart) yearMinor += payment.amountMinor;
    const previous = lastGift.get(payment.partnerId);
    if (!previous || payment.paidAt > previous)
      lastGift.set(payment.partnerId, payment.paidAt);
  }

  const givers: HubGivingRow[] = [];
  let activeCount = 0;
  let lapsedCount = 0;
  for (const partner of partners) {
    const lastGiftAt = lastGift.get(partner.id) ?? null;
    if (!lastGiftAt) continue;
    const status: GivingStatus =
      lastGiftAt.slice(0, 10) >= activeSince ? "active" : "lapsed";
    if (status === "active") activeCount += 1;
    else lapsedCount += 1;
    givers.push({ ...partner, status, lastGiftAt });
  }
  givers.sort((a, b) => (b.lastGiftAt ?? "").localeCompare(a.lastGiftAt ?? ""));

  return {
    partnerCount: partners.length,
    activeCount,
    lapsedCount,
    neverCount: partners.length - activeCount - lapsedCount,
    activeWindowMinor,
    yearMinor,
    activeSince,
    givers,
  };
}
