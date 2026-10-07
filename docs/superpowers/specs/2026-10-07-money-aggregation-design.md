# Money Aggregation by Church — Design Spec (Subsystem #3)

_Date: 2026-10-07_

## 1. Goal

A staff view that shows total money received (MoMo + bank + cash + Paystack) per church, with method breakdowns, rolling up to hub, country, and region. Read-only — no schema changes, no new tables.

## 2. Context

- **Existing aggregation** (`src/lib/poc/dashboard-metrics.ts`): groups payments by geography (country → region block) and payment method. Does NOT group by church or hub.
- **Payment → partner linkage**: 100% of payments have `raw_row.matched_partner_id`. 98.4% of partners have `hub_id` + `church_id`. The join path `payments → partners → hub_churches → hubs → regions` is viable.
- **Existing helpers**: `toGeography(country)` maps country → region block. `toPaymentMethodGroup(method, raw_row)` maps raw method → group (mobile_money, bank, paystack, cash, other). Both are exported and tested.
- **Cash payments** (subsystem #1): promoted to `payments` with `payment_method = 'cash'` and `raw_row.matched_partner_id` — they flow through the same aggregation naturally.

## 3. Architecture

**Server-side aggregation via PostgREST embedded query + in-memory roll-up.**

1. Fetch all `payments` (status=Successful) with embedded `partners(hub_id, church_id, country)` via PostgREST.
2. Fetch `hub_churches` (id, name, hub_id) and `hubs` (id, name, hub_number, region_id) + `regions` (id, code, name) for the join metadata.
3. Aggregate in-memory: group payments by church_id → sum amounts per method → roll up to hub, country, region.
4. Return the aggregated tree as JSON.

No Postgres view or materialized refresh — simpler, works now, can migrate when scale demands (40k partners).

## 4. Aggregation module (`src/lib/poc/money-by-church.ts`)

### Types

```typescript
export type ChurchAggregation = {
  churchId: string;
  churchName: string;
  hubId: string;
  hubLabel: string;
  regionCode: string;
  regionName: string;
  country: string;
  totalMinor: number;
  byMethod: Record<PaymentMethodGroup, number>;
  paymentCount: number;
};

export type HubRollup = {
  hubId: string;
  hubLabel: string;
  regionCode: string;
  totalMinor: number;
  byMethod: Record<PaymentMethodGroup, number>;
  churchCount: number;
};

export type CountryRollup = {
  country: string;
  totalMinor: number;
  byMethod: Record<PaymentMethodGroup, number>;
  churchCount: number;
};

export type RegionRollup = {
  regionCode: string;
  regionName: string;
  totalMinor: number;
  byMethod: Record<PaymentMethodGroup, number>;
  churchCount: number;
};

export type MoneyByChurchResult = {
  churches: ChurchAggregation[];
  rollups: {
    byHub: HubRollup[];
    byCountry: CountryRollup[];
    byRegion: RegionRollup[];
  };
  unattributed: {
    totalMinor: number;
    paymentCount: number;
    byMethod: Record<PaymentMethodGroup, number>;
  };
};
```

### Input

```typescript
export type PaymentForAggregation = {
  amount_minor: number;
  payment_method: string | null;
  raw_row: { matched_partner_id?: string; _payment_method?: string; source?: string } | null;
  paid_at: string;
};

export type PartnerForAggregation = {
  id: string;
  hub_id: string | null;
  church_id: string | null;
  country: string | null;
};

export type ChurchMeta = { id: string; name: string; hub_id: string };
export type HubMeta = { id: string; name: string; hub_number: number | null; region_id: string };
export type RegionMeta = { id: string; code: string; name: string };
```

### Function

```typescript
export function aggregateMoneyByChurch(
  payments: PaymentForAggregation[],
  partners: PartnerForAggregation[],
  churches: ChurchMeta[],
  hubs: HubMeta[],
  regions: RegionMeta[],
  monthFilter?: string,
): MoneyByChurchResult
```

Logic:
1. Build lookup maps: partnerById, churchById, hubById, regionById.
2. For each payment: resolve partner via `raw_row.matched_partner_id`. If no partner → add to `unattributed`. If partner has no `church_id` → group under `"unassigned"` church within their hub. If no hub either → `unattributed`.
3. Group by church_id → sum `amount_minor` per `toPaymentMethodGroup`, count payments.
4. Roll up: sum churches → hubs (by `hub_id`), sum hubs → regions (by `hub.region_id`), sum by country (from partner).
5. If `monthFilter` provided, only include payments where `paid_at` starts with the month.

## 5. API endpoint (`GET /api/poc/giving/by-church`)

Staff (POC session). Optional `?month=YYYY-MM`.

Fetches:
- `payments?select=amount_minor,payment_method,raw_row,paid_at&status=eq.Successful&order=paid_at.desc&limit=5000` (paginated if needed)
- `partners?select=id,hub_id,church_id,country&limit=10000` (paginated)
- `hub_churches?select=id,name,hub_id&limit=5000`
- `hubs?select=id,name,hub_number,region_id&limit=500`
- `regions?select=id,code,name&limit=50`

Calls `aggregateMoneyByChurch` and returns the result.

## 6. UI (`/poc/giving/by-church`)

- **Summary cards** at top: total by region (top 3), total by country (top 3), grand total.
- **Church table**: church name, hub, region, country, total GHS, method breakdown (MoMo / Bank / Cash / Paystack / Other), payment count. Sortable by total desc.
- **Filters**: region dropdown, optional month picker.
- **Expand row**: click a church → fetch and show individual payments (payment_reference, amount, method, date, payer_name).
- **Roll-up sections**: collapsible "By Hub", "By Country", "By Region" tables below the church table.
- Link from `/poc/giving` to this page.

## 7. Tests (`src/lib/poc/money-by-church.test.ts`)

- Aggregates payments to church level with correct method breakdowns.
- Rolls up to hub, country, region correctly.
- Handles payments without `matched_partner_id` → `unattributed`.
- Handles partners without `church_id` → "unassigned" within hub.
- Month filter: only includes payments in the specified month.
- Empty payments → empty result with zero rollups.

## 8. Files

```
src/lib/poc/money-by-church.ts                     (new — aggregation logic)
src/lib/poc/money-by-church.test.ts                (new — unit tests)
src/app/api/poc/giving/by-church/route.ts           (new — staff endpoint)
src/app/poc/giving/by-church/page.tsx               (new — page shell)
src/app/poc/giving/by-church/by-church-client.tsx   (new — client component)
docs/api-spec.md                                    (update — new route)
```

No migration. No schema changes. Read-only.

## 9. Out of scope

- Postgres materialized view (premature at current scale).
- Executive summary export with USD conversion (subsystem #5).
- Partner overview per church/group/country (subsystem #4 — that's partner counts, not money).
- Real-time updates (the page loads on demand; no websocket/realtime).