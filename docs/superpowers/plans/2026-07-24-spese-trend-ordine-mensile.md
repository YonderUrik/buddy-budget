# 6-month trend: monthly top/order recalculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the "Andamento ultimi 6 mesi" ("Last 6 months trend") stacked bar (Spese, i.e. Expenses), both the selection of the "top" categories and the stacking order (including the "Altro" ("Other") segment) are recalculated independently for each month, based on that month's amount, instead of a fixed ranking over the whole half-year.

**Architecture:** `computeCategoryMonthlyTrend` in `lib/calc/expenses.ts` is replaced by `computeCategoryMonthlyStacks`, which for each month produces a `segments` array already sorted by descending amount (individual categories + possibly "Altro" reordered together, not fixed at the end). `ExpenseTrendChart` is rewritten for a "positional slot" rendering (one recharts `<Bar>` per position in the stack, color per single month via `<Cell>`) since recharts shares the stacking order across all the bars of a `BarChart` based on the declaration order of the `<Bar>` components — there is no native per-month order with one `<Bar>` per category. A custom tooltip (not the `formatter` of `ChartTooltipContent`, designed for fixed series names) reads the actual segments of the hovered month directly from the data row.

**Tech Stack:** Next.js/TypeScript, recharts 3.8 (via shadcn's `ChartContainer`/`Bar`/`BarChart`/`Cell`/`Tooltip`), vitest.

## Global Constraints

- No hardcoded colors/values in components: always use the theme tokens (`SWATCH_CHART_COLOR`, `var(--muted-foreground)`), never literal hex.
- Minimal JSDoc on public functions/components (one line).
- All user-visible strings in Italian ("Altro", etc.).
- The existing `compute6MonthTrend` must NOT be removed or modified.
- The segment with the highest amount of a month goes at the **base** of the bar (first declared `<Bar>` = base of the stack in recharts).
- **No fixed legend** below the chart: the category is identified only via the tooltip.

---

### Task 1: `computeCategoryMonthlyStacks` in `lib/calc/expenses.ts`

**Files:**
- Modify: `lib/calc/expenses.ts:325-409` (entirely replaces `MonthlyCategoryTotal`/`CategoryTrendSeries`/`CategoryMonthlyTrend`/`computeCategoryMonthlyTrend`, introduced in the previous plan on this same branch)
- Test: `lib/calc/expenses.test.ts:14` (import), `lib/calc/expenses.test.ts:245-303` (replaces the `describe("computeCategoryMonthlyTrend", ...)` block)

**Interfaces:**
- Consumes: `Transaction`, `Category` (already imported in `expenses.ts`), `computeSummary(transactions, range): ExpensesSummary`, `MONTH_LABELS: string[]`, `addMonths`/`startOfMonth`/`endOfMonth` (internal functions already present in the file, used by `compute6MonthTrend`).
- Produces:
  ```ts
  export interface MonthlyStackSegment {
    key: string;
    name: string;
    color: string;
    amount: number;
  }
  export interface MonthlyCategoryStack {
    year: number;
    month: number;
    label: string;
    segments: MonthlyStackSegment[];
  }
  export function computeCategoryMonthlyStacks(
    transactions: Transaction[],
    categories: Category[],
    referenceDate: Date,
    topCount?: number
  ): MonthlyCategoryStack[]
  ```
  Used by Task 2 (`ExpenseTrendChart`, `app/(app)/spese/page.tsx`).

- [ ] **Step 1: Update the import in the test file**

In `lib/calc/expenses.test.ts`, line 14, replace:

```ts
  computeCategoryMonthlyTrend,
```

with:

```ts
  computeCategoryMonthlyStacks,
```

- [ ] **Step 2: Replace the test block**

In `lib/calc/expenses.test.ts`, replace the whole block from line 245 (`describe("computeCategoryMonthlyTrend", () => {`) to line 303 (the `});` that closes it) with:

```ts
describe("computeCategoryMonthlyStacks", () => {
  it("ricalcola composizione e ordine in modo indipendente per ogni mese (non un ranking fisso sul totale semestre)", () => {
    const referenceDate = new Date(2026, 6, 15); // July 2026
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-300.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-05", amount: "-250.00" }),
      makeTransaction({ categoryId: "cat-c", date: "2026-07-06", amount: "-100.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate, 2);

    expect(months).toHaveLength(6);

    const feb = months.find((m) => m.month === 1);
    expect(feb?.segments).toEqual([{ key: "cat-a", name: "A", color: "blue", amount: 300 }]);

    const jul = months.find((m) => m.month === 6);
    expect(jul?.segments).toEqual([
      { key: "cat-b", name: "B", color: "green", amount: 250 },
      { key: "cat-c", name: "C", color: "red", amount: 100 },
    ]);
  });

  it("riordina 'Altro' insieme alle categorie individuali: se il suo totale supera una categoria top, si posiziona di conseguenza (non fisso in coda)", () => {
    const referenceDate = new Date(2026, 6, 15);
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
      makeCategory({ id: "cat-d", name: "D", color: "yellow" }),
      makeCategory({ id: "cat-e", name: "E", color: "purple" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-07-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-05", amount: "-50.00" }),
      makeTransaction({ categoryId: "cat-c", date: "2026-07-05", amount: "-40.00" }),
      makeTransaction({ categoryId: "cat-d", date: "2026-07-05", amount: "-35.00" }),
      makeTransaction({ categoryId: "cat-e", date: "2026-07-05", amount: "-20.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate, 2);
    const jul = months.find((m) => m.month === 6);

    // individual tops: cat-a (100), cat-b (50). Rest: cat-c+cat-d+cat-e = 95 -> "Altro" lands between cat-a and cat-b.
    expect(jul?.segments).toEqual([
      { key: "cat-a", name: "A", color: "blue", amount: 100 },
      { key: "altro", name: "Altro", color: "altro", amount: 95 },
      { key: "cat-b", name: "B", color: "green", amount: 50 },
    ]);
  });

  it("con meno categorie attive del topCount, l'array segments è più corto e non contiene chiavi fantasma", () => {
    const referenceDate = new Date(2026, 6, 15);
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-07-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-06", amount: "-50.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate);
    const jul = months.find((m) => m.month === 6);

    expect(jul?.segments).toEqual([
      { key: "cat-a", name: "A", color: "blue", amount: 100 },
      { key: "cat-b", name: "B", color: "green", amount: 50 },
    ]);
  });

  it("con nessuna categoria o transazione ritorna 6 mesi con segments vuoto", () => {
    const referenceDate = new Date(2026, 6, 15);
    const months = computeCategoryMonthlyStacks([], [], referenceDate);

    expect(months).toHaveLength(6);
    expect(months.every((m) => m.segments.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `computeCategoryMonthlyStacks` is not exported from `./expenses` (import/undefined error), plus possible leftover errors for references still pointing to `computeCategoryMonthlyTrend` if Step 4 has not been done yet.

- [ ] **Step 4: Replace the implementation**

In `lib/calc/expenses.ts`, replace the whole block from line 325 (`export interface MonthlyCategoryTotal {`) to line 409 (the `}` that closes `computeCategoryMonthlyTrend`) with:

```ts
export interface MonthlyStackSegment {
  key: string;
  name: string;
  color: string;
  amount: number;
}

export interface MonthlyCategoryStack {
  year: number;
  month: number;
  label: string;
  segments: MonthlyStackSegment[];
}

const OTHER_STACK_SEGMENT_KEY = "altro";

/**
 * Actual spending per category over the last 6 calendar months, with the top `topCount` categories
 * and a possible "Altro" segment recalculated independently for each month (not a fixed ranking
 * on the half-year total): the same category can take different positions, or end up inside
 * "Altro", from one month to the next. "Altro" is reordered together with the individual categories by
 * amount, it is not fixed at the end.
 */
export function computeCategoryMonthlyStacks(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): MonthlyCategoryStack[] {
  const months: MonthlyCategoryStack[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = addMonths(referenceDate, -i);
    const range: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };

    const categoryAmounts = categories
      .map((category) => {
        const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
        const amount = computeSummary(categoryTransactions, range).speseEffettive;
        return { category, amount };
      })
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const topEntries = categoryAmounts.slice(0, topCount);
    const restEntries = categoryAmounts.slice(topCount);

    const segments: MonthlyStackSegment[] = topEntries.map((entry) => ({
      key: entry.category.id,
      name: entry.category.name,
      color: entry.category.color,
      amount: entry.amount,
    }));

    const otherAmount = restEntries.reduce((sum, entry) => sum + entry.amount, 0);
    if (otherAmount > 0) {
      segments.push({
        key: OTHER_STACK_SEGMENT_KEY,
        name: "Altro",
        color: OTHER_STACK_SEGMENT_KEY,
        amount: otherAmount,
      });
    }

    segments.sort((a, b) => b.amount - a.amount);

    months.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      segments,
    });
  }

  return months;
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: PASS — all the tests in `expenses.test.ts`, including the new `computeCategoryMonthlyStacks` block. No regressions in the other blocks (in particular `compute6MonthTrend`, unchanged).

- [ ] **Step 6: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: ricalcola top/ordine mensile in computeCategoryMonthlyStacks"
```

---

### Task 2: Positional-slot rendering in `ExpenseTrendChart` + Spese page integration

**Files:**
- Modify: `components/domain/expenses/expense-trend-chart.tsx` (complete rewrite, it was 81 lines)
- Modify: `app/(app)/spese/page.tsx:20` (import), `:199-202` (component usage)

**Interfaces:**
- Consumes: `computeCategoryMonthlyStacks`, `MonthlyCategoryStack`, `MonthlyStackSegment` from Task 1 (`lib/calc/expenses.ts`); `SWATCH_CHART_COLOR: Record<SwatchColor, string>` from `components/domain/shared/color-swatches.ts`; `CategoryColor` from `lib/validation/categories.ts` (alias of `SwatchColor`); `formatCurrency(amount: number, currency: string): string` from `lib/format.ts`.
- Produces: `ExpenseTrendChart({ monthlyStacks, currency })` — replaces the prop `monthlyCategoryTrend: CategoryMonthlyTrend` with `monthlyStacks: MonthlyCategoryStack[]`. Only consumer: `app/(app)/spese/page.tsx` (already confirmed in the previous plan on this branch, no other file imports `ExpenseTrendChartProps`).

- [ ] **Step 1: Rewrite `components/domain/expenses/expense-trend-chart.tsx`**

Replace the whole content of the file with:

```tsx
"use client";

/** Spese chart: stacked bars "Andamento ultimi 6 mesi", per-category segments recalculated month by month (top 6 + possibly "Altro", ordered by the amount of that specific month). */

import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { MonthlyCategoryStack, MonthlyStackSegment } from "@/lib/calc/expenses";
import type { CategoryColor } from "@/lib/validation/categories";

/** Fixed color (not a swatch) for the aggregated "Altro" segment, so it is not confused with a real category. */
const OTHER_SEGMENT_COLOR = "var(--muted-foreground)";

export interface ExpenseTrendChartProps {
  monthlyStacks: MonthlyCategoryStack[];
  currency: string;
}

interface MonthlyStackRow {
  label: string;
  segments: MonthlyStackSegment[];
  [slotAmountKey: string]: unknown;
}

function segmentColor(segment: MonthlyStackSegment): string {
  return segment.key === "altro" ? OTHER_SEGMENT_COLOR : SWATCH_CHART_COLOR[segment.color as CategoryColor];
}

/** Turns the months into recharts data rows with one positional slot (`posNAmount`) for each stack position, up to `maxSlots`. */
function buildRows(months: MonthlyCategoryStack[], maxSlots: number): MonthlyStackRow[] {
  return months.map((month) => {
    const row: MonthlyStackRow = { label: month.label, segments: month.segments };
    for (let i = 0; i < maxSlots; i++) {
      row[`pos${i}Amount`] = month.segments[i]?.amount;
    }
    return row;
  });
}

interface MonthlyStackTooltipProps extends TooltipProps<number, string> {
  currency: string;
}

/** Custom tooltip: reads the actual segments of the hovered month from the data row (`payload[0].payload.segments`), because name/color per slot change every month and the `formatter` of `ChartTooltipContent` assumes a fixed name per series. */
function MonthlyStackTooltip({ active, payload, currency }: MonthlyStackTooltipProps) {
  const row = payload?.[0]?.payload as MonthlyStackRow | undefined;
  if (!active || !row || row.segments.length === 0) return null;

  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {row.segments.map((segment) => (
        <div key={segment.key} className="flex w-full items-center justify-between gap-3">
          <span className="text-muted-foreground">{segment.name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatCurrency(segment.amount, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ExpenseTrendChart({ monthlyStacks, currency }: ExpenseTrendChartProps) {
  const maxSlots = monthlyStacks.reduce((max, month) => Math.max(max, month.segments.length), 0);
  const rows = buildRows(monthlyStacks, maxSlots);
  const slots = Array.from({ length: maxSlots }, (_, i) => i);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="max-h-56 w-full">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<MonthlyStackTooltip currency={currency} />} />
            {slots.map((slotIndex) => (
              <Bar key={slotIndex} dataKey={`pos${slotIndex}Amount`} stackId="trend">
                {rows.map((row, rowIndex) => {
                  const segment = row.segments[slotIndex];
                  return <Cell key={rowIndex} fill={segment ? segmentColor(segment) : "transparent"} />;
                })}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Update `app/(app)/spese/page.tsx`**

Line 20, replace the import:

```ts
  computeCategoryMonthlyTrend,
```

with:

```ts
  computeCategoryMonthlyStacks,
```

Lines 199-202, replace the component call:

```tsx
          <ExpenseTrendChart
            monthlyStacks={computeCategoryMonthlyStacks(filteredTransactions, safeCategories, referenceDate)}
            currency={currency}
          />
```

- [ ] **Step 3: Verify build and lint**

Run: `pnpm exec tsc --noEmit`
Expected: no TypeScript errors (in particular no leftover reference to `computeCategoryMonthlyTrend`/`CategoryMonthlyTrend`/`monthlyCategoryTrend` in `expense-trend-chart.tsx` or `page.tsx`). Note: `pnpm build` in this sandbox requires `DATABASE_URL` (no Postgres available) — `tsc --noEmit` is the equivalent type check without needing the DB, consistent with the note already in CLAUDE.md.

Run: `pnpm lint`
Expected: no new errors introduced (the pre-existing technical debt of 2 `react-hooks/set-state-in-effect` errors in `components/theme-toggle.tsx` and `category-breakdown-donut.tsx`, not touched by this task, may remain).

- [ ] **Step 4: Run the whole suite of pure tests**

Run: `pnpm vitest run lib/`
Expected: PASS on all files — no regressions in the existing tests (`expenses.test.ts` with the new Task 1 tests, `distribute-colors.test.ts`, `split-slider.utils.test.ts`, `category-breakdown-donut.utils.test.ts`, etc.). The DB integration tests (`lib/db/integration.test.ts`, `lib/gocardless/*.test.ts`) fail due to the absence of Postgres in this sandbox — a known environmental limit, not a regression of this task.

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/expense-trend-chart.tsx "app/(app)/spese/page.tsx"
git commit -m "feat: rendering a slot posizionali per ordine stack mensile in Andamento 6 mesi"
```

---

## Manual verification (outside the tasks, to be done by the user)

No Postgres/Redis available in the agentic sandbox for a real browser test. To verify manually:
- Moving from one month to the next, the order of the segments in the bar changes consistently with that month's amounts (the largest always at the base).
- A month in which "Altro" exceeds a "top" category: the "Altro" segment (gray) appears lower in the stack than that category, not always on top.
- A month with few active categories: visibly lower bar, no empty/ghost segment.
- No fixed legend below the chart; the tooltip on hover over a bar shows only the segments actually present that month, with correct name and amount.
- No category with spending in the half-year (or a category filter that zeroes everything): empty bars, no console errors.
