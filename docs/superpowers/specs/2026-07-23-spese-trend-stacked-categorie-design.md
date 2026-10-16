# Last 6 months trend: stacked bar by category

Date: 2026-07-23

## Context

The "Andamento ultimi 6 mesi" (last 6 months trend) chart in Spese (`components/domain/expenses/expense-trend-chart.tsx`) today shows a single bar per month with the total spent (`compute6MonthTrend` in `lib/calc/expenses.ts`). User request: add the per-category breakdown, as a stacked bar (bars stacked by category instead of a single colour).

## Decisions

- The stacked bar **replaces** the current single-bar chart (it does not live alongside it).
- With users who may have 15-20+ categories, showing every category as a separate segment would make chart and legend unreadable. The **top 6** categories (by total spending over the six months) are shown as their own segments, the rest aggregated into an **"Altro"** ("Other") segment.
- The top-6 ranking is computed once over the whole six-month period (not per single month), so that each category always occupies the same visual "slice" month after month — this avoids categories changing position/colour from one bar to the next.

## Data layer (`lib/calc/expenses.ts`)

New pure function, next to `compute6MonthTrend` (which stays unchanged, used elsewhere/in the future if only the total is needed):

```ts
export interface MonthlyCategoryTotal {
  year: number;
  month: number;
  label: string;
  amounts: Record<string, number>; // key = CategoryTrendSeries.key, value = positive actual spending
}

export interface CategoryTrendSeries {
  key: string;       // categoryId, or "altro"
  name: string;      // category name, or "Altro"
  color: string;      // CategoryColor (shared palette token), or "altro" handled separately in the component
}

export interface CategoryMonthlyTrend {
  months: MonthlyCategoryTotal[];
  series: CategoryTrendSeries[]; // stacking order: descending rank by total six-month spending, "altro" always last
}

export function computeCategoryMonthlyTrend(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): CategoryMonthlyTrend
```

Logic:
1. For each of the 6 calendar months (same scheme as `compute6MonthTrend`: `i` from 5 to 0, `addMonths(referenceDate, -i)`, full range `startOfMonth`..`endOfMonth`, **no clamp on `today`** — consistent with `compute6MonthTrend`, since future transactions do not exist in practice), compute the actual spending for each of the user's categories with `computeSummary`, filtering transactions by `categoryId`.
2. Sum the total per category over the whole six-month period (across the 6 months).
3. Sort the categories by six-month total descending, take the first `topCount` as their own series.
4. If there are categories beyond the first `topCount` with a six-month total > 0, aggregate their monthly spending into an extra series `{ key: "altro", name: "Altro", color: "altro" }`, appended at the end of `series`. If there are none, `altro` does not appear at all (neither in `series` nor in the keys of `amounts`).
5. Each month's `amounts` has a key for every resulting `series.key` (including those at 0, for uniform rendering).

No change to the existing `compute6MonthTrend`: it stays available if only the total is needed in the future.

## UI component (`components/domain/expenses/expense-trend-chart.tsx`)

- Props: `monthlyCategoryTrend: CategoryMonthlyTrend` (replaces `monthlyTrend: MonthlyTotal[]`), `currency: string` (unchanged).
- Chart data: one object per month with `label` + the keys of `amounts` spread (`{ label, ...month.amounts }`).
- One recharts `<Bar>` for each `series`, all with `stackId="trend"`, in the order of `series` (so "Altro", if present, is the topmost segment).
  - Colour: `SWATCH_CHART_COLOR[entry.color as CategoryColor]` for real categories (the same helper already used by `CategoryBreakdownDonut`).
  - Fixed colour `var(--muted-foreground)` for the `altro` series (not a swatch, so it is not confused with a real category that has that colour).
- Tooltip: reuses the existing `tooltipValueFormatter` pattern (name + amount in currency); shadcn's `ChartTooltipContent` already shows one row for each active series at the hover point, no change needed to that mechanism.
- Own legend below the chart: one row per series with a coloured dot (same colour as the series) + name. No interactivity (click-to-filter, visibility toggle) — out of scope, not requested.
- `ChartConfig` built dynamically from `series` (needed because the keys are dynamic, unlike the current static `TREND_CONFIG`).

## Integration (`app/(app)/spese/page.tsx`)

Replace the call to `compute6MonthTrend(filteredTransactions, referenceDate)` (line 200) with `computeCategoryMonthlyTrend(filteredTransactions, categories, referenceDate)`, passing the result as `monthlyCategoryTrend` to `ExpenseTrendChart`.

## Edge cases

- No spending in the six months (for the user or after a category filter): empty `series`, empty chart, no legend — the same current behaviour with empty data.
- Category filter active on the page (`filterTransactions`, already applied upstream): the transactions arrive already restricted to that category, so the stacked bar naturally shows only that single series (never an "Altro" segment in that case, since no other categories exist in the filtered transactions).
- Categories with duplicate names/colours among themselves: not a new case introduced by this feature (already possible today in Categorie), no special handling needed.

## Tests

New test in `lib/calc/expenses.test.ts` for `computeCategoryMonthlyTrend`: correct top-N ranking, correct "Altro" aggregation (present/absent), key consistency across months, no regression on the existing `compute6MonthTrend` (unchanged).

## Out of scope (explicitly excluded)

- Clicking the legend to filter/highlight a series.
- Removal of `compute6MonthTrend` (it stays for possible future uses of the total alone).
- Changes to the existing category/text filter mechanism.
