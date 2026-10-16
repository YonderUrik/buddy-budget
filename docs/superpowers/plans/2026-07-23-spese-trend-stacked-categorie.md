# 6-month trend: stacked bar per category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "Andamento ultimi 6 mesi" ("Last 6 months trend") chart in Spese (Expenses) shows a stacked bar per category (top 6 + "Altro" ("Other")) instead of a single-color bar with only the total.

**Architecture:** New pure function `computeCategoryMonthlyTrend` in `lib/calc/expenses.ts` (same scheme as `compute6MonthTrend`, which is not modified) that computes, for each of the 6 calendar months, the actual spending for the top 6 categories (by total spending over the half-year) plus an "Altro" aggregate for the rest. `ExpenseTrendChart` is rewritten to render one recharts `<Bar>` per series with a common `stackId`, colors from the shared palette (`SWATCH_CHART_COLOR`), tooltip and its own legend consistent with the rest of the Spese UI.

**Tech Stack:** Next.js/TypeScript, recharts (via shadcn's `ChartContainer`/`Bar`/`BarChart` component), vitest.

## Global Constraints

- No hardcoded colors/values in components: always use the theme tokens (`SWATCH_CHART_COLOR`, `var(--muted-foreground)`), never literal hex.
- Minimal JSDoc on public functions/components (one line).
- All user-visible strings in Italian ("Altro", etc.).
- The existing `compute6MonthTrend` must NOT be removed or modified.

---

### Task 1: `computeCategoryMonthlyTrend` in `lib/calc/expenses.ts`

**Files:**
- Modify: `lib/calc/expenses.ts` (add after `compute6MonthTrend`, around line 323)
- Test: `lib/calc/expenses.test.ts` (add after the `describe("compute6MonthTrend", ...)` block, around line 242)

**Interfaces:**
- Consumes: `Transaction`, `Category` (already imported in `expenses.ts`), `computeSummary(transactions, range): ExpensesSummary`, `MONTH_LABELS`, `addMonths`/`startOfMonth`/`endOfMonth` (internal functions already present in the file).
- Produces:
  ```ts
  export interface MonthlyCategoryTotal {
    year: number;
    month: number;
    label: string;
    amounts: Record<string, number>;
  }
  export interface CategoryTrendSeries {
    key: string;
    name: string;
    color: string;
  }
  export interface CategoryMonthlyTrend {
    months: MonthlyCategoryTotal[];
    series: CategoryTrendSeries[];
  }
  export function computeCategoryMonthlyTrend(
    transactions: Transaction[],
    categories: Category[],
    referenceDate: Date,
    topCount?: number
  ): CategoryMonthlyTrend
  ```
  Used by Task 2 (`ExpenseTrendChart`, `app/(app)/spese/page.tsx`).

- [ ] **Step 1: Write the failing tests**

Add in `lib/calc/expenses.test.ts`, right after the `describe("compute6MonthTrend", ...)` block (around line 242). Also update the import at the top of the file to include `computeCategoryMonthlyTrend`:

```ts
import {
  computeKpis,
  computeSummary,
  effectiveAmount,
  getPeriodRange,
  getPreviousPeriodRange,
  isExpense,
  parseDateOnly,
  scaleBudgetForPeriod,
  computeCategoryBreakdown,
  computeFixedVsVariable,
  compute6MonthTrend,
  computeCategoryMonthlyTrend,
  filterTransactions,
  shiftReferenceDate,
  formatPeriodLabel,
} from "./expenses";
```

New test block:

```ts
describe("computeCategoryMonthlyTrend", () => {
  it("assegna alle top `topCount` categorie una serie propria, ordinate per spesa totale semestre discendente, e aggrega il resto in 'altro'", () => {
    const referenceDate = new Date(2026, 6, 15); // July 2026
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-300.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-05", amount: "-200.00" }),
      makeTransaction({ categoryId: "cat-c", date: "2026-07-06", amount: "-50.00" }),
    ];

    const trend = computeCategoryMonthlyTrend(transactions, categories, referenceDate, 2);

    expect(trend.series).toEqual([
      { key: "cat-a", name: "A", color: "blue" },
      { key: "cat-b", name: "B", color: "green" },
      { key: "altro", name: "Altro", color: "altro" },
    ]);
    expect(trend.months).toHaveLength(6);

    const feb = trend.months.find((m) => m.month === 1);
    expect(feb?.amounts).toEqual({ "cat-a": 300, "cat-b": 0, altro: 0 });

    const jul = trend.months.find((m) => m.month === 6);
    expect(jul?.amounts).toEqual({ "cat-a": 0, "cat-b": 200, altro: 50 });
  });

  it("omette la serie 'altro' quando non ci sono categorie oltre le top N con spesa positiva", () => {
    const referenceDate = new Date(2026, 6, 15);
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-07-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-06", amount: "-50.00" }),
    ];

    const trend = computeCategoryMonthlyTrend(transactions, categories, referenceDate);

    expect(trend.series).toEqual([
      { key: "cat-a", name: "A", color: "blue" },
      { key: "cat-b", name: "B", color: "green" },
    ]);
    expect(trend.months.every((m) => !("altro" in m.amounts))).toBe(true);
  });

  it("con nessuna categoria ritorna 6 mesi vuoti e nessuna serie", () => {
    const referenceDate = new Date(2026, 6, 15);
    const trend = computeCategoryMonthlyTrend([], [], referenceDate);

    expect(trend.series).toEqual([]);
    expect(trend.months).toHaveLength(6);
    expect(trend.months.every((m) => Object.keys(m.amounts).length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `computeCategoryMonthlyTrend` is not exported from `./expenses` (import/undefined error).

- [ ] **Step 3: Implement `computeCategoryMonthlyTrend`**

Add in `lib/calc/expenses.ts`, right after the closing of the `compute6MonthTrend` function (after line 323 `}`):

```ts
export interface MonthlyCategoryTotal {
  year: number;
  month: number;
  label: string;
  amounts: Record<string, number>;
}

export interface CategoryTrendSeries {
  key: string;
  name: string;
  color: string;
}

export interface CategoryMonthlyTrend {
  months: MonthlyCategoryTotal[];
  series: CategoryTrendSeries[];
}

const OTHER_TREND_SERIES_KEY = "altro";

/**
 * Actual spending per category over the last 6 calendar months, with the top `topCount` categories
 * (by total spending over the half-year) as their own series and the rest aggregated into an "Altro" series.
 * The ranking is computed only once over the whole half-year, so that each category always keeps
 * the same segment/color from one month to the next.
 */
export function computeCategoryMonthlyTrend(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): CategoryMonthlyTrend {
  const monthRanges: { year: number; month: number; label: string; range: DateRange }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = addMonths(referenceDate, -i);
    monthRanges.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      range: { from: startOfMonth(monthDate), to: endOfMonth(monthDate) },
    });
  }

  const perMonthByCategory = new Map<string, number[]>();
  const totalByCategory = new Map<string, number>();

  categories.forEach((category) => {
    const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
    const perMonth = monthRanges.map((m) => computeSummary(categoryTransactions, m.range).speseEffettive);
    perMonthByCategory.set(category.id, perMonth);
    totalByCategory.set(category.id, perMonth.reduce((sum, v) => sum + v, 0));
  });

  const rankedCategories = [...categories].sort(
    (a, b) => (totalByCategory.get(b.id) ?? 0) - (totalByCategory.get(a.id) ?? 0)
  );
  const topCategories = rankedCategories.slice(0, topCount);
  const restCategories = rankedCategories.slice(topCount);
  const hasOther = restCategories.some((category) => (totalByCategory.get(category.id) ?? 0) > 0);

  const series: CategoryTrendSeries[] = topCategories.map((category) => ({
    key: category.id,
    name: category.name,
    color: category.color,
  }));
  if (hasOther) {
    series.push({ key: OTHER_TREND_SERIES_KEY, name: "Altro", color: OTHER_TREND_SERIES_KEY });
  }

  const months: MonthlyCategoryTotal[] = monthRanges.map((m, index) => {
    const amounts: Record<string, number> = {};
    topCategories.forEach((category) => {
      amounts[category.id] = perMonthByCategory.get(category.id)?.[index] ?? 0;
    });
    if (hasOther) {
      amounts[OTHER_TREND_SERIES_KEY] = restCategories.reduce(
        (sum, category) => sum + (perMonthByCategory.get(category.id)?.[index] ?? 0),
        0
      );
    }
    return { year: m.year, month: m.month, label: m.label, amounts };
  });

  return { months, series };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: PASS — all the tests in `expenses.test.ts`, including the new `computeCategoryMonthlyTrend` block.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiungi computeCategoryMonthlyTrend per stacked bar per categoria"
```

---

### Task 2: Stacked bar in `ExpenseTrendChart` + Spese page integration

**Files:**
- Modify: `components/domain/expenses/expense-trend-chart.tsx` (complete rewrite, it was 58 lines)
- Modify: `app/(app)/spese/page.tsx:18-26` (import), `:199-202` (component usage)

**Interfaces:**
- Consumes: `computeCategoryMonthlyTrend` and the types `CategoryMonthlyTrend`/`CategoryTrendSeries`/`MonthlyCategoryTotal` from Task 1 (`lib/calc/expenses.ts`); `SWATCH_CHART_COLOR: Record<SwatchColor, string>` from `components/domain/shared/color-swatches.ts`; `CategoryColor` from `lib/validation/categories.ts` (alias of `SwatchColor`).
- Produces: `ExpenseTrendChart({ monthlyCategoryTrend, currency })` — replaces the prop `monthlyTrend: MonthlyTotal[]` with `monthlyCategoryTrend: CategoryMonthlyTrend`. No other file consumes `ExpenseTrendChartProps` besides `app/(app)/spese/page.tsx`.

- [ ] **Step 1: Rewrite `components/domain/expenses/expense-trend-chart.tsx`**

Replace the whole content of the file with:

```tsx
"use client";

/** Spese chart: stacked bars "Andamento ultimi 6 mesi", one segment per category (top 6 + possibly "Altro"). */

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { CategoryMonthlyTrend, CategoryTrendSeries } from "@/lib/calc/expenses";
import type { CategoryColor } from "@/lib/validation/categories";

/** Fixed color (not a swatch) for the aggregated "Altro" series, so it is not confused with a real category. */
const OTHER_SERIES_COLOR = "var(--muted-foreground)";

export interface ExpenseTrendChartProps {
  monthlyCategoryTrend: CategoryMonthlyTrend;
  currency: string;
}

/** Formats the tooltip value (name + amount in currency) instead of the numeric default of ChartTooltipContent. */
function tooltipValueFormatter(currency: string) {
  return function TooltipValue(value: ValueType | undefined, name: NameType | undefined) {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-muted-foreground">{name}</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatCurrency(Number(value), currency)}
        </span>
      </div>
    );
  };
}

function seriesColor(series: CategoryTrendSeries): string {
  return series.key === "altro" ? OTHER_SERIES_COLOR : SWATCH_CHART_COLOR[series.color as CategoryColor];
}

export function ExpenseTrendChart({ monthlyCategoryTrend, currency }: ExpenseTrendChartProps) {
  const { months, series } = monthlyCategoryTrend;
  const trendData = months.map((month) => ({ label: month.label, ...month.amounts }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  const chartConfig = series.reduce<ChartConfig>((config, entry) => {
    config[entry.key] = { label: entry.name, color: seriesColor(entry) };
    return config;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="max-h-56 w-full">
          <BarChart data={trendData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            {series.map((entry) => (
              <Bar key={entry.key} dataKey={entry.key} name={entry.name} stackId="trend" fill={seriesColor(entry)} />
            ))}
          </BarChart>
        </ChartContainer>
        {series.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {series.map((entry) => (
              <div key={entry.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: seriesColor(entry) }} />
                {entry.name}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Update `app/(app)/spese/page.tsx`**

At the top of the file (lines 18-26), replace the import of `compute6MonthTrend` with `computeCategoryMonthlyTrend`:

```ts
import {
  computeCategoryBreakdown,
  computeCategoryMonthlyTrend,
  computeFixedVsVariable,
  computeSummary,
  filterTransactions,
  getPeriodRange,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
```

At the end of the file (lines 199-202), replace the component call:

```tsx
          <ExpenseTrendChart
            monthlyCategoryTrend={computeCategoryMonthlyTrend(filteredTransactions, safeCategories, referenceDate)}
            currency={currency}
          />
```

- [ ] **Step 3: Verify build and lint**

Run: `pnpm build`
Expected: build completed without TypeScript errors (in particular no leftover reference to `compute6MonthTrend`/`monthlyTrend` in `expense-trend-chart.tsx` or `page.tsx`).

Run: `pnpm lint`
Expected: no new errors introduced (the pre-existing technical debt of 2 `react-hooks/set-state-in-effect` errors, not touched by this task, may remain).

- [ ] **Step 4: Run the whole test suite**

Run: `pnpm vitest run`
Expected: PASS — no regressions in the existing tests (`expenses.test.ts`, `distribute-colors.test.ts`, `split-slider.utils.test.ts`, `category-breakdown-donut.utils.test.ts`, etc.).

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/expense-trend-chart.tsx "app/(app)/spese/page.tsx"
git commit -m "feat: stacked bar per categoria in Andamento 6 mesi (Spese)"
```

---

## Manual verification (outside the tasks, to be done by the user)

As for the previous Spese/Categorie features, no Postgres/Redis is available in the agentic sandbox for a real browser test. To verify manually:
- With more than 6 categories with spending in the half-year: the "Altro" segment appears, in a gray color distinguishable from the real categories.
- With 6 or fewer categories with spending: no "Altro" segment, no "Altro" entry in the legend.
- The tooltip on hover over a monthly bar shows all the series of that month with the correct amount in currency.
- The legend below the chart lists the same series as the chart, with the same order and color.
