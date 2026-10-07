# Executive Summary Export — Design Spec (Subsystem #5)

_Date: 2026-10-07_

## 1. Goal

A one-page leadership summary showing total money received, USD conversion, and the derived "active partners" count — exportable as CSV and printable.

## 2. Formula (user-specified)

- **USD rate**: 1 USD = 12 GHS (fixed, configurable later in `app_settings`)
- **Active partners** = `floor(total USD ÷ 5)` — i.e., total GHS ÷ 12 ÷ 5 = total GHS ÷ 60

## 3. Data source

Reads from the existing `payments` ledger (status=Successful). Reuses `toPaymentMethodGroup` from `dashboard-metrics.ts` for method breakdowns. No new tables, no migration.

## 4. API endpoint (`GET /api/poc/giving/executive-summary`)

Staff (POC session). Optional `?month=YYYY-MM` to scope to a single month (default: all-time cumulative).

Returns:
```json
{
  "ok": true,
  "month": null,
  "totalGhsMinor": 5000000,
  "totalUsd": 41666.67,
  "activePartners": 8333,
  "fxRate": 12,
  "activeThresholdUsd": 5,
  "byMethod": {
    "mobile_money": 3000000,
    "bank": 1500000,
    "cash": 200000,
    "paystack": 300000,
    "other": 0
  },
  "byRegion": [
    { "region": "Ghana", "totalGhsMinor": 3000000, "totalUsd": 25000, "activePartners": 5000 },
    { "region": "Africa", "totalGhsMinor": 1000000, "totalUsd": 8333.33, "activePartners": 1666 }
  ],
  "paymentCount": 1462
}
```

## 5. Aggregation module (`src/lib/poc/executive-summary.ts`)

Pure function:
```typescript
export function buildExecutiveSummary(
  payments: { amount_minor: number; payment_method: string | null; raw_row: Record<string, unknown> | null; paid_at: string; payer_phone_e164: string | null }[],
  partners: { id: string; country: string | null; momo_phone_number: string | null; whatsapp_number: string | null }[],
  monthFilter?: string,
  fxRate = 12,
  activeThresholdUsd = 5,
): ExecutiveSummary
```

- Sums `amount_minor` across all successful payments (or filtered by month).
- Groups by `toPaymentMethodGroup` for method breakdown.
- Groups by `toGeography(partner.country)` for region breakdown (same partner-matching logic as `dashboard-metrics.ts`: `raw_row.matched_partner_id` → partner → geography, fallback Ghana).
- Converts: `totalUsd = totalGhsMinor / 100 / fxRate`, `activePartners = floor(totalUsd / activeThresholdUsd)`.
- Per-region: same formula on the region subtotal.

## 6. UI (`/poc/giving/executive-summary`)

- **Headline cards**: Total GHS, Total USD, Active Partners, Payment Count.
- **Method breakdown table**: MoMo / Bank / Cash / Paystack / Other — GHS and USD per method.
- **Region breakdown table**: each geography — GHS, USD, Active Partners.
- **Export buttons**: "Export CSV" (downloads a CSV of the summary), "Print" (window.print).
- **Month filter**: optional `<input type="month">` — default all-time.
- Formula note displayed: "1 USD = 12 GHS · Active = Total USD ÷ $5".

CSV format:
```
Metric,Value
Total (GHS),50000.00
Total (USD),4166.67
Active Partners,833
Payment Count,1462

By Method,GHS,USD
Mobile Money,30000.00,2500.00
Bank,15000.00,1250.00
...

By Region,GHS,USD,Active Partners
Ghana,30000.00,2500.00,500
Africa,10000.00,833.33,166
...
```

## 7. Tests (`src/lib/poc/executive-summary.test.ts`)

- Sums all payments correctly.
- USD conversion: 50000 minor → 500 GHS → 41.67 USD at rate 12.
- Active partners: 41.67 USD ÷ 5 = 8 (floor).
- Method breakdown sums to total.
- Region breakdown sums to total.
- Month filter: only includes payments in the specified month.
- Empty payments → zero result.

## 8. Files

```
src/lib/poc/executive-summary.ts                    (new — aggregation + formula)
src/lib/poc/executive-summary.test.ts               (new — unit tests)
src/app/api/poc/giving/executive-summary/route.ts    (new — staff endpoint)
src/app/poc/giving/executive-summary/page.tsx        (new — page shell)
src/app/poc/giving/executive-summary/summary-client.tsx (new — client with CSV/print export)
docs/api-spec.md                                     (update — new route)
```