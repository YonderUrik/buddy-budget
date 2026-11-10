# Sidebar widgets (summary, deadlines, FIRE)

Feature area(s): Desktop sidebar on every page of the web app (modules: "Patrimonio netto", "Portafoglio", "Watchlist", "Prossime scadenze", "Obiettivo FIRE"). On mobile these are natural candidates for a Home/Dashboard screen or widgets.
Source: `app/api/sidebar/**/route.ts`, `lib/sidebar/*`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | /api/sidebar/summary | Net worth + month change, portfolio with holdings, watchlist, triggered alerts | session | read-only; light queries |
| GET | /api/sidebar/deadlines | Next debt installments and bank connections to renew (max 4) | session | read-only |
| GET | /api/sidebar/fire | FIRE progress with Analitiche assumptions | session | DE -> 403; heaviest (`maxDuration = 30`) |

All three use `withRoute(..., { quietOnSuccess: true })` (successful requests not logged). Read-only: no DB writes, no demo guard, no jobs, no external API calls (prices/FX read from DB). No Cache-Control headers set.

Module visibility is a per-device preference stored in web `localStorage` (`bb:sidebar:module:<id>`), not on the server (`lib/sidebar/modules.ts`).

---

## GET /api/sidebar/summary
Route name: `sidebar.summary` · Auth: session · Guards: none (available for DE; pension part empty for DE)

**Response** `200` — all amounts JSON **numbers** in the user's currency.
```ts
interface SidebarSummary {
  currency: string;                  // user currency, default "EUR"
  netWorth: {
    total: number;                   // liquidity (sum of account balances) + portfolio value + pension (latest snapshot per fund) - debts residual
    monthChange: number | null;      // total - net worth ~30 days ago (null if no stored snapshot on/before that date)
    pension: { total: number; monthChange: number | null } | null; // pension share of total; null when no pension value
  } | null;                          // null when user has nothing (no balance, no holdings, no debts, no pension)
  portfolio: {
    totalValue: number;
    dayChange: number | null;
    dayChangePct: number | null;     // fraction (0.01 = 1%)
    totalGain: number;
    totalGainPct: number | null;     // fraction on total invested
    holdings: Array<{                // open positions, largest first
      instrumentId: string;
      label: string;                 // Yahoo symbol base (<= 8 chars, e.g. "VWCE") else instrument name
      name: string;
      value: number | null;          // null if missing price or FX
      dayChangePct: number | null;   // fraction
      spark: number[];               // recent closes (~35 days), date asc
      triggeredAlerts: number;
    }>;
  } | null;                          // null when no held instruments
  watchlist: Array<{                 // watched and NOT held
    instrumentId: string; label: string; name: string;
    currency: string;                // instrument currency (lastClose is in this currency)
    lastClose: number | null;
    dayChangePct: number | null;
    spark: number[];
    triggeredAlerts: number;
  }>;
  triggeredAlerts: number;           // total triggered price alerts on all titles
}
```
```json
{ "currency": "EUR",
  "netWorth": { "total": 84520.33, "monthChange": 1210.5, "pension": { "total": 21430.12, "monthChange": 0 } },
  "portfolio": { "totalValue": 48210, "dayChange": -120.4, "dayChangePct": -0.0025, "totalGain": 6210.8, "totalGainPct": 0.148,
    "holdings": [ { "instrumentId": "i1…", "label": "VWCE", "name": "Vanguard FTSE All-World", "value": 30120, "dayChangePct": -0.003,
      "spark": [118.2, 118.9, 119.4], "triggeredAlerts": 0 } ] },
  "watchlist": [ { "instrumentId": "i9…", "label": "AAPL", "name": "Apple Inc.", "currency": "USD", "lastClose": 231.4,
    "dayChangePct": 0.011, "spark": [225.1, 229.8, 231.4], "triggeredAlerts": 1 } ],
  "triggeredAlerts": 1 }
```
**Errors:** 401 empty.
**Mobile notes:** good single call for a dashboard header. Values are "now" (today's liquidity from current balances, not snapshots). Called on every page on web; cache briefly.

---

## GET /api/sidebar/deadlines
Route name: `sidebar.deadlines` · Auth: session · Guards: none

Merges debt installments (`buildDebtsView(...).overview.nextDue`, i.e. next unpaid installment per open loan, max 5) with bank connections (non-orphaned) whose health state is `expiring` (consent expires within 7 days), `expired` or `error`; sorted by `date` then `id`; truncated to **4** (`MAX_SIDEBAR_DEADLINES`).

**Response** `200`
```ts
interface SidebarDeadlines {
  currency: string;
  items: Array<{
    id: string;                 // "rata:<debtId>" | "rinnovo:<connectionId>"
    kind: "rata" | "rinnovo";   // installment | bank renewal
    label: string;              // debt name | "Rinnova <institutionName>" (Italian, hard-coded)
    date: string;               // "YYYY-MM-DD"; renewals: consent expiry if expiring, otherwise today
    amount: number | null;      // installment amount; null for renewals
    overdue: boolean;           // installment overdue | renewal already expired/error
    href: string;               // WEB route: "/debiti/finanziamenti?id=<debtId>" or "/liquidita/conti?rinnova=sidebar"
  }>;
}
```
```json
{ "currency": "EUR", "items": [
  { "id": "rinnovo:c1…", "kind": "rinnovo", "label": "Rinnova Intesa Sanpaolo", "date": "2026-10-18", "amount": null, "overdue": true, "href": "/liquidita/conti?rinnova=sidebar" },
  { "id": "rata:d1…", "kind": "rata", "label": "Mutuo casa", "date": "2026-11-01", "amount": 718.97, "overdue": false, "href": "/debiti/finanziamenti?id=d1…" } ] }
```
**Errors:** 401 empty.
**Mobile notes:** `href` values are web paths; map them to native navigation (`kind` + id suffix is enough). The `label` for renewals is an Italian string built server-side (not localized for DE/English).

---

## GET /api/sidebar/fire
Route name: `sidebar.fire` · Auth: session · Guards: country (DE -> 403)

`loadAnalyticsSnapshot(userId)` (same data and assumptions as Analitiche) -> `toSidebarFire`.

**Response** `200`
```ts
interface SidebarFire {
  currency: string;
  wealth: number;              // as in Analitiche: liquidity + investments (+ pension if assumptions.includePensionFunds)
  target: number | null;       // FIRE number; null if annual spending unknown
  progress: number | null;     // wealth/target, may exceed 1
  yearsToFire: number | null;  // FRACTIONAL years (log formula, not rounded); 0 if already reached; null if unreachable or > max planning horizon
}
```
```json
{ "currency": "EUR", "wealth": 120000, "target": 750000, "progress": 0.16, "yearsToFire": 21.5 }
```
**Errors:** 401 empty; `403 { code: "country_feature_unavailable", error }` for DE.
**Mobile notes:** heaviest sidebar call; fetch only when the FIRE widget is visible and cache; invalidate after `PUT /api/analytics/assumptions`.

## Cross-cutting observations
- `/api/sidebar/fire` wraps `withCountryGuard` **outside** `withRoute` (guard 401/403 responses lack `x-request-id`).
- `/api/sidebar/deadlines` returns web `href` paths and a non-localized Italian label.
