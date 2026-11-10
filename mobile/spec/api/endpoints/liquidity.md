# Liquidity month and analysis views

Feature area(s): Liquidità · Movimenti — month sentence ("Hai X su N conti", pace line, "N movimenti aspettano una
categoria"), the «Il mese» column (spent, income, typical so far, spending by group, to fix), budget progress
([features/03-transactions.md](../../features/03-transactions.md) TX-008 and the month aside)
Source: `app/api/liquidity/month/route.ts`, `lib/views/liquidity-month.ts` (`buildLiquidityMonth`, pure),
`lib/views/liquidity-month.server.ts` (`loadLiquidityMonth`), `lib/views/schemas.ts` (`liquidityMonthSchema`)
Status: implemented on branch `feat/mobile-api-foundations` of `buddy-budget` (gaps.md **G3**, **G6**). Not merged yet.
Analisi source: `app/api/liquidity/analysis/route.ts`, `lib/views/liquidity-analysis.ts` (`buildLiquidityAnalysis`, pure),
`lib/views/liquidity-analysis.server.ts`, `liquidityAnalysisSchema`; the sentence is `lib/liquidity/analysis-sentence.ts`, shared with the web page.

The server runs the functions of `app/(app)/liquidita/page.tsx` and `LiquidityOverview`: `filterTransactions` (account
scope), `computeSummary` / `computeIncomeSummary` (month), `computeMonthPace`, `computeGroupTotals("mese")`,
`computeKpis("mese")` (budget totals), `computeCategoryBreakdown("mese")` (per-category spend for budget progress, as
Analisi does), `buildVoiceLines`. The feed itself comes from the paged `GET /api/transactions` ([transactions.md](./transactions.md#get-apitransactions)).

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/liquidity/month` | Month figures, pace, groups and budget progress for Movimenti | session (Bearer) | not country-gated |
| GET | `/api/liquidity/analysis` | Everything Liquidità · Analisi shows for one period | session (Bearer) | not country-gated |

---

## GET /api/liquidity/month

Route name: `liquidity.month` · Auth: session required · Guards: proxy gates

**Query params**

| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| accountId | uuid | no | all accounts | scopes every figure to one account, as the account chips on the web. The `voice` sentence always describes all accounts (as on the web) |
| today | `YYYY-MM-DD` | no | server's day | send the device's local day |

**Response** `200` — `LiquidityMonth` (validated by `liquidityMonthSchema`). Money is JSON numbers. Fixtures:
[liquidity-month.json](../fixtures/liquidity-month.json), [liquidity-month-account.json](../fixtures/liquidity-month-account.json)
(scoped to the linked account), [liquidity-month-en-empty.json](../fixtures/liquidity-month-en-empty.json) (English user without data).

```ts
interface LiquidityMonth {
  currency: string;
  today: string;
  month: { from: string; to: string; label: string };   // calendar month of `today`; label localized ("ottobre")
  accountId: string | null;
  accounts: { total: number; count: number };           // all accounts: "Hai 23.915 € su 4 conti"
  spent: number;                                        // effective spend this month (after "Dividi", transfers excluded)
  income: number;                                       // effective income this month
  pace: MonthPace;                                      // same shape as overview.md `monthPace`; pace.typicalSoFar = «Di solito a questo punto»
  groups: { key: "dovuta" | "voluta" | "futuro" | "saltuaria"; label: string; amount: number }[]; // display order, localized labels
  uncategorizedSpent: number;                           // spend still on «Da categorizzare» this month
  budget: { total: number; spent: number; remaining: number } | null;  // null when no budget is set; spent = budgeted categories only
  budgets: {                                            // one per category with a monthly budget > 0, highest progress first
    categoryId: string; name: string;                   // name localized (G11)
    color: string; icon: string; group: string;
    budget: number; spent: number; remaining: number;   // remaining can be negative (over budget)
    progress: number;                                   // spent / budget, can exceed 1
  }[];
  toFix: number;                                        // uncategorized transactions (all time) = /api/transactions/attention uncategorizedCount
  voice: { key: "pace"; segments: { text: string; strong?: boolean }[] }[];
}
```

Example (curves trimmed to three values):

```json
{
  "currency": "EUR", "today": "2026-10-18",
  "month": { "from": "2026-10-01", "to": "2026-10-31", "label": "ottobre" },
  "accountId": null, "accounts": { "total": 23915.34, "count": 4 },
  "spent": 2163.83, "income": 0,
  "pace": { "spentSoFar": 2163.83, "typicalSoFar": 1355.9733333333334, "income": 0, "budgetTotal": 780, "budgetSpent": 398.83000000000004,
            "dayOfMonth": 18, "daysInMonth": 31, "current": [0, 428, 428], "typical": [0, 0, 39.416666666666664] },
  "groups": [ { "key": "dovuta", "label": "Dovute", "amount": 1842.09 }, { "key": "voluta", "label": "Volute", "amount": 137.74 },
              { "key": "futuro", "label": "Te futuro", "amount": 0 }, { "key": "saltuaria", "label": "Saltuarie", "amount": 0 } ],
  "uncategorizedSpent": 184,
  "budget": { "total": 780, "spent": 398.83000000000004, "remaining": 381.16999999999996 },
  "budgets": [
    { "categoryId": "b2ea6d99-2cf0-4793-b686-1bf54a6ac827", "name": "Spesa", "color": "green", "icon": "shopping-cart", "group": "dovuta",
      "budget": 420, "spent": 318.99000000000007, "remaining": 101.00999999999993, "progress": 0.7595000000000002 },
    { "categoryId": "6c7875c1-d7d5-4495-8a29-1b07607e6763", "name": "Shopping", "color": "pink", "icon": "shopping-bag", "group": "voluta",
      "budget": 150, "spent": 0, "remaining": 150, "progress": 0 }
  ],
  "toFix": 5,
  "voice": [ { "key": "pace", "segments": [ { "text": "Ottobre è partito sopra il solito: " }, { "text": "2164 €", "strong": true }, { "text": " spesi, " },
                                            { "text": "808 € in più", "strong": true }, { "text": " della tua media a questo punto." } ] } ]
}
```

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no / invalid session |
| 400 | `{ "error": "accountId non valido", "code": "validation_failed", "field": "accountId" }` | `accountId` is not a UUID (an unknown or foreign UUID just yields zero figures) |
| 400 | `{ "error": "today deve avere formato YYYY-MM-DD", "code": "invalid_date", "field": "today" }` | malformed `today` |

**Side effects**: none.

## Mobile notes

- Movimenti = this endpoint (header + «Il mese») + paged `GET /api/transactions?limit=…` (feed). Refetch both after
  any transaction / category / budget mutation and after a bank sync finishes.
- The pace line is `voice[0]`; the "N movimenti aspettano una categoria" tail comes from `toFix` (localize locally:
  "movimento aspetta" / "movimenti aspettano" + "una categoria").
- Budget editing stays `PUT /api/budgets/{categoryId}` ([budgets.md](./budgets.md)); this view only reads.
- The spending analysis tab (Analisi) is `GET /api/liquidity/analysis` below.

---

## GET /api/liquidity/analysis

Route name: `liquidity.analysis` · Auth: session required · Guards: proxy gates

Runs the functions of `app/(app)/liquidita/analisi/page.tsx` on the web's own transaction window
(`liquidityFetchWindow(ref)`: 1 January of the previous year → 31 December of `ref`'s year): `filterTransactions`
(account scope), `getPeriodRange` / `getPreviousPeriodRange`, `computeSummary` (spent, spent before),
`buildCumulativeSpend` (curve), `computeMonthPace().typical` (current month only), `computeCategoryBreakdown` grouped by
`GROUP_DISPLAY` with `scaleBudgetForPeriod`, `computeIncomeSources`, `computeAccumulatedSavings(getTrendRange)` and
`buildAnalysisSentence`.

**Query params**

| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| period | `settimana` \| `mese` \| `3mesi` \| `anno` | no | `mese` | the stepper's period |
| ref | `YYYY-MM-DD` | no | `today` | any day inside the period on screen (the stepper moves it; period navigation stays a local port, [domain/expenses.md](../../domain/expenses.md)) |
| accountId | uuid | no | all accounts | scopes every figure to one account |
| today | `YYYY-MM-DD` | no | server's day | device's local day |

**Response** `200` — `LiquidityAnalysis` (`liquidityAnalysisSchema`). Money is JSON numbers. Fixtures:
[liquidity-analysis.json](../fixtures/liquidity-analysis.json) (current month),
[liquidity-analysis-previous-month.json](../fixtures/liquidity-analysis-previous-month.json) (`ref` in September: no typical line),
[liquidity-analysis-anno.json](../fixtures/liquidity-analysis-anno.json) (`period=anno`, 12-month savings).

```ts
interface LiquidityAnalysis {
  currency: string; today: string; period: "settimana" | "mese" | "3mesi" | "anno"; accountId: string | null;
  range: { from: string; to: string };          // period on screen
  previousRange: { from: string; to: string };  // same calendar length, just before
  isCurrentMonth: boolean;                      // period = mese and contains today
  spent: number; spentBefore: number;
  delta: number;                                // spent − spentBefore; show «▲ +x / ▼ −x rispetto al periodo prima» only when spentBefore > 0
  curve: { date: string; value: number }[];     // cumulative spend per day, range.from → min(range.to, today); empty for a future period
  typical: number[] | null;                     // dashed «Di solito» line, index = day of month − 1; only when isCurrentMonth
  groups: {                                     // «Dove vanno i soldi»: groups with spend, largest first; may include "daCategorizzare"
    key: "dovuta" | "voluta" | "futuro" | "saltuaria" | "daCategorizzare"; label: string; amount: number;
    categories: { id: string; name: string; color: string; icon: string; amount: number;
                  budget: number | null }[];    // monthly budget scaled to the period (×3 for 3mesi, ×12 for anno, ×7/30 for settimana — scaleBudgetForPeriod)
  }[];
  hasBudgets: boolean;                          // link label: «Modifica i budget» vs «Imposta un budget»
  incomeSources: { categoryId: string; name: string; color: string; icon: string; amount: number; quotaPct: number | null }[]; // «Da dove arrivano»
  savings: { month: string /* YYYY-MM */; cumulative: number }[];  // 6 months ending in ref's month (12 for anno)
  saved: number;                                // last cumulative: «Messo da parte» (≥ 0) or «In meno»
  sentence: string;                             // localized lead sentence
}
```

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no / invalid session |
| 400 | `{ "code": "invalid_period", "field": "period" }` | unknown `period` (note: the net-worth periods `1mese`… are not accepted here) |
| 400 | `{ "code": "invalid_date", "field": "today" \| "ref" }` | malformed date |
| 400 | `{ "code": "validation_failed", "field": "accountId" }` | `accountId` is not a UUID |

**Side effects**: none. Tapping a category opens Movimenti filtered by it (paged `GET /api/transactions?categoryId=`).
