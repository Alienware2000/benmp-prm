# Partner Overview & Submission Monitoring — Design Spec (Subsystem #4)

_Date: 2026-10-07_

## 1. Goal

Two staff views:
1. **Partners per church / hub / country** — a read-only overview showing partner counts grouped by church, rolling up to hub, country, and region.
2. **Cash form submission monitoring** — a view showing which churches have filed their monthly cash form and which haven't, using the existing `cash_submissions` table and `GET /api/poc/cash/submissions` endpoint.

Both are read-only. No schema changes.

## 2. Context

- **Existing partner data**: `partners` table has `church_id` (FK → `hub_churches`), `hub_id` (FK → `hubs`), `country`, `status`. 98.4% of partners have `hub_id` + `church_id`.
- **Existing hierarchy**: `regions` → `hubs` → `hub_churches` → `partners`.
- **Existing cash submissions endpoint**: `GET /api/poc/cash/submissions` already returns submissions with joined church/hub/region names, status, and summary counts. Just needs a UI.
- **Existing dashboard**: `dashboard-metrics.ts` counts partners by geography (region block), not by church/hub.
- **Subsystem #3** built the money-by-church view at `/poc/giving/by-church` — this is the complementary "people by church" view.

## 3. Architecture

Two separate pages, each with its own API endpoint:

### Page 1: Partners per church (`/poc/partners/by-church`)

**API: `GET /api/poc/partners/by-church`**

Fetches `partners` (id, hub_id, church_id, country, status), `hub_churches` (id, name, hub_id), `hubs` (id, name, hub_number, region_id), `regions` (id, code, name). Aggregates in-memory:

```json
{
  "ok": true,
  "churches": [
    {
      "churchId": "…",
      "churchName": "Qodesh",
      "hubId": "…",
      "hubLabel": "Hub 8 - Cape Coast",
      "regionCode": "UD_GHANA",
      "regionName": "UD Ghana",
      "country": "Ghana",
      "partnerCount": 120,
      "byStatus": { "active": 80, "new": 5, "needs_follow_up": 3, "inactive": 2, "other": 30 }
    }
  ],
  "rollups": {
    "byHub": [{ "hubId", "hubLabel", "regionCode", "partnerCount", "churchCount" }],
    "byCountry": [{ "country", "partnerCount", "churchCount" }],
    "byRegion": [{ "regionCode", "regionName", "partnerCount", "churchCount" }]
  },
  "unassigned": { "partnerCount": 16, "byStatus": {…} }
}
```

Partners without `church_id` → "unassigned" within their hub. Partners without `hub_id` → `unassigned` bucket.

**UI**: same pattern as `/poc/giving/by-church` — church table with roll-up sections, summary cards, region filter.

### Page 2: Cash submission monitoring (`/poc/cash/monitoring`)

**API**: reuses existing `GET /api/poc/cash/submissions` — no new endpoint needed.

**UI**:
- Table of cash submissions: church name, hub, region, reporting month, status (submitted/promoted/flagged), total cash, registered/active/new/lapsed counts, submitted_at.
- Filter by status and reporting month.
- "Not yet filed" view: fetch all `hub_churches`, compare against submissions for the selected month, show churches that have NOT filed. This requires a new endpoint: `GET /api/poc/cash/monitoring?month=YYYY-MM` — returns `{ filed: [...], notFiled: [...] }` by cross-referencing `cash_submissions` against `hub_churches`.

## 4. Aggregation module (`src/lib/poc/partners-by-church.ts`)

Pure function, same pattern as `money-by-church.ts`:

```typescript
export function aggregatePartnersByChurch(
  partners: PartnerForCount[],
  churches: ChurchMeta[],
  hubs: HubMeta[],
  regions: RegionMeta[],
): PartnerByChurchResult
```

Groups partners by `church_id`, counts by `status`, rolls up to hub/country/region. Partners without `church_id` → "unassigned" within hub. Partners without `hub_id` → `unassigned` bucket.

## 5. Monitoring endpoint (`GET /api/poc/cash/monitoring`)

Staff endpoint under `/api/poc/`. Optional `?month=YYYY-MM` (default: current month).

Fetches:
- All `hub_churches` (id, name, hub_id)
- `hubs` (id, name) for display
- `cash_submissions` for the selected month (church_id, status, total_cash_minor, etc.)

Returns:
```json
{
  "ok": true,
  "month": "2026-10",
  "filed": [{ "churchId", "churchName", "hubLabel", "status", "totalCashMinor", "submittedAt" }],
  "notFiled": [{ "churchId", "churchName", "hubLabel" }],
  "summary": { "totalChurches": 100, "filedCount": 30, "notFiledCount": 70 }
}
```

## 6. Tests

- **Unit** (`partners-by-church.test.ts`): aggregates partner counts by church with status breakdowns; rolls up to hub/country/region; handles unassigned partners; empty input → zero result.
- The monitoring endpoint is a simple join + diff — no unit test needed (integration via the route).

## 7. Files

```
src/lib/poc/partners-by-church.ts                      (new — aggregation logic)
src/lib/poc/partners-by-church.test.ts                 (new — unit tests)
src/app/api/poc/partners/by-church/route.ts             (new — staff endpoint)
src/app/poc/partners/by-church/page.tsx                 (new — page shell)
src/app/poc/partners/by-church/by-church-client.tsx     (new — client component)
src/app/api/poc/cash/monitoring/route.ts                (new — monitoring endpoint)
src/app/poc/cash/monitoring/page.tsx                    (new — page shell)
src/app/poc/cash/monitoring/monitoring-client.tsx       (new — client component)
docs/api-spec.md                                        (update — new routes)
```

No migration. No schema changes.

## 8. Out of scope

- Executive summary export with USD conversion (subsystem #5).
- Partner detail drill-down (the existing directory at `/poc/directory` already handles this).
- Editing partner church assignments from this view (read-only).