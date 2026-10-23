/**
 * Office "Admins" tab (Decision 0036): the office's view of every hub admin's
 * report, drilled down region block -> hub -> branch. Pure aggregation, no I/O;
 * the data is loaded by ./admins-data.
 *
 * Giving reuses aggregateMoneyByChurch so these totals match the Money by
 * Church page exactly. Cash filing is read from cash_submissions for the month.
 */

import {
  aggregateMoneyByChurch,
  type ChurchMeta,
  type HubMeta,
  type PartnerForAggregation,
  type PaymentForAggregation,
  type RegionMeta,
} from "./money-by-church";

/**
 * The office's nine blocks, in the order and with the short names the office
 * asked for (BENMP PORTAL WORKSHOP, 2026-10-15). Labels live here, not in
 * `regions.name`, so the hub login screen keeps its existing names. A block with
 * no region code has no hubs yet and is shown as "not set up".
 */
export const ADMIN_BLOCKS: readonly {
  label: string;
  regionCode: string | null;
}[] = [
  { label: "UD GH", regionCode: "UD_GHANA" },
  { label: "UJ", regionCode: "UJ_GHANA" },
  { label: "RSC", regionCode: "RSC_GHANA" },
  { label: "UD AF", regionCode: "AFRICA" },
  { label: "UD EU", regionCode: "EUROPE" },
  { label: "UD NA", regionCode: null },
  { label: "Eschatos Int", regionCode: "ESCHATOS" },
  { label: "UI", regionCode: null },
  { label: "First Love", regionCode: null },
];

export type AdminHubMeta = HubMeta & { leader_name: string | null };
export type AccountMeta = { hub_id: string; last_login_at: string | null };
export type CashSubmissionMeta = {
  church_id: string;
  total_cash_minor: number;
  status: string;
};

export type AdminsInput = {
  regions: RegionMeta[];
  hubs: AdminHubMeta[];
  accounts: AccountMeta[];
  churches: (ChurchMeta & { leader_name?: string | null })[];
  partners: PartnerForAggregation[];
  /** Successful payments; only those in `month` are counted. */
  payments: PaymentForAggregation[];
  /** Cash submissions for `month` only. */
  cashSubmissions: CashSubmissionMeta[];
};

export type HubStats = {
  hubId: string;
  label: string;
  regionCode: string;
  adminName: string;
  adminSignedIn: boolean;
  lastSignIn: string | null;
  partners: number;
  branches: number;
  cashFiled: number;
  givingMinor: number;
};

export type AdminBlock = {
  label: string;
  regionCode: string | null;
  setUp: boolean;
  hubs: number;
  adminsSignedIn: number;
  partners: number;
  branches: number;
  cashFiled: number;
  givingMinor: number;
};

export type BranchRow = {
  churchId: string;
  name: string;
  pastor: string;
  partners: number;
  givingMinor: number;
  cashFiled: boolean;
  cashMinor: number;
};

export type HubReport = {
  hub: HubStats;
  branches: BranchRow[];
  /** Giving from this hub's partners who have no branch yet. */
  noBranchGivingMinor: number;
};

/** Hub-level figures for every hub, for `month` ("YYYY-MM"). */
export function computeHubStats(
  input: AdminsInput,
  month: string,
): Map<string, HubStats> {
  const regionById = new Map(input.regions.map((r) => [r.id, r]));
  const accountByHub = new Map(input.accounts.map((a) => [a.hub_id, a]));
  const filedChurches = new Set(input.cashSubmissions.map((s) => s.church_id));
  const money = aggregateMoneyByChurch(
    input.payments,
    input.partners,
    input.churches,
    input.hubs,
    input.regions,
    month,
  );
  const givingByHub = new Map(
    money.rollups.byHub.map((h) => [h.hubId, h.totalMinor]),
  );

  const stats = new Map<string, HubStats>();
  for (const h of input.hubs) {
    const account = accountByHub.get(h.id);
    stats.set(h.id, {
      hubId: h.id,
      label: h.hub_number === null ? h.name : `Hub ${h.hub_number} - ${h.name}`,
      regionCode: regionById.get(h.region_id)?.code ?? "UNKNOWN",
      adminName: h.leader_name ?? "",
      adminSignedIn: Boolean(account?.last_login_at),
      lastSignIn: account?.last_login_at ?? null,
      partners: 0,
      branches: 0,
      cashFiled: 0,
      givingMinor: givingByHub.get(h.id) ?? 0,
    });
  }
  for (const c of input.churches) {
    const s = stats.get(c.hub_id);
    if (!s) continue;
    s.branches += 1;
    if (filedChurches.has(c.id)) s.cashFiled += 1;
  }
  for (const p of input.partners) {
    const s = p.hub_id ? stats.get(p.hub_id) : undefined;
    if (s) s.partners += 1;
  }
  return stats;
}

/** The office's blocks in order, plus any region the list does not name yet. */
export function buildBlocks(
  regions: RegionMeta[],
  hubStats: Map<string, HubStats>,
  blocks: readonly {
    label: string;
    regionCode: string | null;
  }[] = ADMIN_BLOCKS,
): AdminBlock[] {
  const known = new Set(regions.map((r) => r.code));
  const named = new Set(blocks.map((b) => b.regionCode).filter(Boolean));
  const extra = regions
    .filter((r) => !named.has(r.code))
    .map((r) => ({ label: r.name, regionCode: r.code }));

  return [...blocks, ...extra].map(({ label, regionCode }) => {
    const hubs = [...hubStats.values()].filter(
      (h) => regionCode && h.regionCode === regionCode,
    );
    return {
      label,
      regionCode,
      setUp: regionCode !== null && known.has(regionCode),
      hubs: hubs.length,
      adminsSignedIn: hubs.filter((h) => h.adminSignedIn).length,
      partners: sum(hubs, (h) => h.partners),
      branches: sum(hubs, (h) => h.branches),
      cashFiled: sum(hubs, (h) => h.cashFiled),
      givingMinor: sum(hubs, (h) => h.givingMinor),
    };
  });
}

/** Hubs of one region, in login order (hub number, then name). */
export function hubsForRegion(
  hubs: AdminHubMeta[],
  hubStats: Map<string, HubStats>,
  regionCode: string,
): HubStats[] {
  return [...hubs]
    .sort(
      (a, b) =>
        (a.hub_number ?? Infinity) - (b.hub_number ?? Infinity) ||
        a.name.localeCompare(b.name),
    )
    .map((h) => hubStats.get(h.id))
    .filter(
      (s): s is HubStats => s !== undefined && s.regionCode === regionCode,
    );
}

/** One hub's branches: people, giving and cash filing for `month`. */
export function buildHubReport(
  input: AdminsInput,
  month: string,
  hubId: string,
): HubReport | null {
  const hub = computeHubStats(input, month).get(hubId);
  if (!hub) return null;

  const money = aggregateMoneyByChurch(
    input.payments,
    input.partners,
    input.churches,
    input.hubs,
    input.regions,
    month,
  );
  const givingByChurch = new Map(
    money.churches.map((c) => [c.churchId, c.totalMinor]),
  );
  const cashByChurch = new Map(
    input.cashSubmissions.map((s) => [s.church_id, s]),
  );
  const partnersByChurch = new Map<string, number>();
  for (const p of input.partners) {
    if (p.hub_id === hubId && p.church_id) {
      partnersByChurch.set(
        p.church_id,
        (partnersByChurch.get(p.church_id) ?? 0) + 1,
      );
    }
  }

  const branches = input.churches
    .filter((c) => c.hub_id === hubId)
    .map((c) => {
      const cash = cashByChurch.get(c.id);
      return {
        churchId: c.id,
        name: c.name,
        pastor: c.leader_name ?? "",
        partners: partnersByChurch.get(c.id) ?? 0,
        givingMinor: givingByChurch.get(c.id) ?? 0,
        cashFiled: Boolean(cash),
        cashMinor: cash?.total_cash_minor ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    hub,
    branches,
    noBranchGivingMinor: givingByChurch.get(`unassigned:${hubId}`) ?? 0,
  };
}

/** "YYYY-MM" from a query value, or the current month (UTC) if missing/invalid. */
export function resolveMonth(
  value: string | string[] | undefined,
  now = new Date(),
): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
    ? v
    : now.toISOString().slice(0, 7);
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}
