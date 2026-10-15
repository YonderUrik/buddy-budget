# Spese: multi-level pie and section reordering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Fisse vs variabili" ("Fixed vs variable") donut + the separate budget list with a single multi-level pie (inner layer: type, outer layer: category) with an integrated budget/percentages legend, and move the transaction list above the "Andamento ultimi 6 mesi" ("Last 6 months trend") chart.

**Architecture:** A new `CategoryBreakdownDonut` component (nested recharts `<Pie>` + custom legend) replaces `CategoryBreakdown` and the donut part of `ExpenseCharts`; `ExpenseCharts` is renamed `ExpenseTrendChart` and keeps only the bar chart. No new calculation function: the existing `computeCategoryBreakdown`/`computeFixedVsVariable` are enough. A new pure module (`category-breakdown-donut.utils.ts`) isolates category sorting and percentage calculation, tested with vitest.

**Tech Stack:** Next.js App Router, TypeScript, recharts (via shadcn's `ChartContainer`/`ChartTooltip`), TanStack Query (existing `useUpsertBudgetMutation`), vitest.

## Global Constraints

- All user-visible strings in Italian (see CLAUDE.md — "Convenzioni componenti").
- No hardcoded colors in components: use theme tokens. Technical exception documented in Task 1: the hex values for the pie (fill of recharts `Cell`, which requires a literal CSS value, not a Tailwind class) live **only** as new tokens in `app/globals.css` (`:root` and `.dark`), never as a literal string in a component.
- Minimal JSDoc (one `/** ... */` line) on every exported public component and function.
- External imports always from the `components/domain/expenses/index.ts` barrel, never from internal files.
- `components/domain/` must not depend on `app/`.
- Package manager: pnpm. Test: `pnpm exec vitest run <path>`. Build: `pnpm build`. Lint: `pnpm lint`.
- No changes to `lib/calc/expenses.ts`, the API routes, `SplitSlider` or `TransactionRow`.

---

### Task 1: Color tokens for the category pie

**Files:**
- Modify: `app/globals.css` (`:root` and `.dark` blocks)
- Modify: `components/domain/shared/color-swatches.ts`

**Interfaces:**
- Produces: `SWATCH_CHART_COLOR: Record<SwatchColor, string>` — maps each `SwatchColor` (`slate`/`blue`/`green`/`yellow`/`purple`/`orange`/`red`/`teal`) to a `var(--swatch-<colore>)` string usable as a literal `fill` in a recharts `Cell`.

**Note:** no dedicated test for this task — `COLOR_SWATCH_MAP` and `COLOR_DOT`, already in the same file, are static maps without tests; same convention here.

- [ ] **Step 1: Add the 8 new color tokens to `app/globals.css`**

In the `:root` block (after the line `--chart-5: #b6c4bc;`, line 87), add:

```css
  --swatch-slate: #94a3b8;
  --swatch-blue: #3b82f6;
  --swatch-green: #22c55e;
  --swatch-yellow: #facc15;
  --swatch-purple: #a855f6;
  --swatch-orange: #f97316;
  --swatch-red: #ef4444;
  --swatch-teal: #14b8a6;
```

In the `.dark` block (after the line `--chart-5: #2f4940;`, line 129), add the same block (same values — the swatch colors already don't vary by theme today, see `COLOR_DOT` in the same file, which uses a single class without a `dark:` variant):

```css
  --swatch-slate: #94a3b8;
  --swatch-blue: #3b82f6;
  --swatch-green: #22c55e;
  --swatch-yellow: #facc15;
  --swatch-purple: #a855f6;
  --swatch-orange: #f97316;
  --swatch-red: #ef4444;
  --swatch-teal: #14b8a6;
```

- [ ] **Step 2: Add the `SWATCH_CHART_COLOR` map in `color-swatches.ts`**

Open `components/domain/shared/color-swatches.ts` and add at the bottom of the file (after `COLOR_DOT`):

```ts
/** Color -> CSS var map for the multi-level pie (recharts requires a literal value, not a Tailwind class). */
export const SWATCH_CHART_COLOR: Record<SwatchColor, string> = {
  slate: "var(--swatch-slate)",
  blue: "var(--swatch-blue)",
  green: "var(--swatch-green)",
  yellow: "var(--swatch-yellow)",
  purple: "var(--swatch-purple)",
  orange: "var(--swatch-orange)",
  red: "var(--swatch-red)",
  teal: "var(--swatch-teal)",
};
```

- [ ] **Step 3: Check that the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (the file only exports a new constant, no consumers yet).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/domain/shared/color-swatches.ts
git commit -m "feat: aggiunge token colore swatch per la torta categorie spese"
```

---

### Task 2: Pure module `category-breakdown-donut.utils.ts` (TDD)

**Files:**
- Create: `components/domain/expenses/category-breakdown-donut.utils.ts`
- Test: `components/domain/expenses/category-breakdown-donut.utils.test.ts`

**Interfaces:**
- Consumes: `CategoryAmount` from `@/lib/calc/expenses` (already exists: `{ categoryId, name, type: "fissa"|"variabile", amount, color, icon }`).
- Produces:
  - `sortCategoryAmounts(categoryAmounts: CategoryAmount[]): CategoryAmount[]`
  - `computeBudgetStats(amount: number, budgetAmount: number, totalSpeso: number): BudgetStats`
  - `interface BudgetStats { saturazionePct: number | null; quotaPct: number | null }`

- [ ] **Step 1: Write the tests (they will fail — the module does not exist yet)**

Create `components/domain/expenses/category-breakdown-donut.utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeBudgetStats, sortCategoryAmounts } from "./category-breakdown-donut.utils";
import type { CategoryAmount } from "@/lib/calc/expenses";

function makeEntry(overrides: Partial<CategoryAmount>): CategoryAmount {
  return {
    categoryId: "id",
    name: "Categoria",
    type: "variabile",
    amount: 0,
    color: "slate",
    icon: "package",
    ...overrides,
  };
}

describe("sortCategoryAmounts", () => {
  it("mette tutte le categorie fisse prima delle variabili", () => {
    const input = [
      makeEntry({ categoryId: "v1", type: "variabile", amount: 100 }),
      makeEntry({ categoryId: "f1", type: "fissa", amount: 10 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["f1", "v1"]);
  });

  it("dentro lo stesso tipo ordina per importo decrescente", () => {
    const input = [
      makeEntry({ categoryId: "f-low", type: "fissa", amount: 10 }),
      makeEntry({ categoryId: "f-high", type: "fissa", amount: 50 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["f-high", "f-low"]);
  });

  it("mantiene le categorie a importo zero nell'ordinamento", () => {
    const input = [
      makeEntry({ categoryId: "zero", type: "variabile", amount: 0 }),
      makeEntry({ categoryId: "speso", type: "variabile", amount: 20 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["speso", "zero"]);
  });

  it("non modifica l'array originale", () => {
    const input = [makeEntry({ categoryId: "a", amount: 1 }), makeEntry({ categoryId: "b", amount: 2 })];
    const originalOrder = input.map((e) => e.categoryId);
    sortCategoryAmounts(input);
    expect(input.map((e) => e.categoryId)).toEqual(originalOrder);
  });
});

describe("computeBudgetStats", () => {
  it("calcola la saturazione normale del budget", () => {
    expect(computeBudgetStats(50, 100, 200).saturazionePct).toBe(50);
  });

  it("saturazione oltre il 100% quando si supera il budget", () => {
    expect(computeBudgetStats(150, 100, 200).saturazionePct).toBe(150);
  });

  it("saturazione null se il budget è 0", () => {
    expect(computeBudgetStats(50, 0, 200).saturazionePct).toBeNull();
  });

  it("calcola la quota sul totale speso", () => {
    expect(computeBudgetStats(50, 100, 200).quotaPct).toBe(25);
  });

  it("quota null se il totale speso è 0", () => {
    expect(computeBudgetStats(0, 100, 0).quotaPct).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: FAIL — `Cannot find module './category-breakdown-donut.utils'`

- [ ] **Step 3: Implement the module**

Create `components/domain/expenses/category-breakdown-donut.utils.ts`:

```ts
import type { CategoryAmount } from "@/lib/calc/expenses";

const TYPE_ORDER: Record<CategoryAmount["type"], number> = { fissa: 0, variabile: 1 };

/** Sorts categories by type (fixed before variable) and, within each group, by amount spent descending. */
export function sortCategoryAmounts(categoryAmounts: CategoryAmount[]): CategoryAmount[] {
  return [...categoryAmounts].sort((a, b) => {
    if (a.type !== b.type) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    return b.amount - a.amount;
  });
}

export interface BudgetStats {
  /** Budget saturation percentage (spent / budget * 100). null if the budget is 0 (cannot be computed). */
  saturazionePct: number | null;
  /** Percentage of the total spent in the period (spent / total * 100). null if the total is 0 (cannot be computed). */
  quotaPct: number | null;
}

/** Computes the budget saturation and share-of-total-spent percentages for a category. */
export function computeBudgetStats(amount: number, budgetAmount: number, totalSpeso: number): BudgetStats {
  return {
    saturazionePct: budgetAmount > 0 ? (amount / budgetAmount) * 100 : null,
    quotaPct: totalSpeso > 0 ? (amount / totalSpeso) * 100 : null,
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: PASS — 9 green tests

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.utils.ts components/domain/expenses/category-breakdown-donut.utils.test.ts
git commit -m "feat: aggiunge ordinamento categorie e calcolo percentuali budget per la torta Spese"
```

---

### Task 3: `CategoryBreakdownDonut` component

**Files:**
- Create: `components/domain/expenses/category-breakdown-donut.tsx`

**Interfaces:**
- Consumes:
  - `sortCategoryAmounts`, `computeBudgetStats`, `BudgetStats` from `./category-breakdown-donut.utils` (Task 2)
  - `SWATCH_CHART_COLOR` from `@/components/domain/shared/color-swatches` (Task 1)
  - `CategoryAvatar` from `@/components/domain/categories`
  - `useUpsertBudgetMutation` from `@/lib/queries/budgets`
  - `CategoryAmount`, `FixedVsVariable` from `@/lib/calc/expenses`
  - `Budget` from `@/lib/db/schema/budgets`
  - `CategoryColor`, `CategoryIcon` from `@/lib/validation/categories`
  - `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig` from `@/components/ui/chart`
  - `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`
  - `Input` from `@/components/ui/input`
  - `Badge` from `@/components/ui/badge`
  - `formatCurrency` from `@/lib/format`
- Produces: `CategoryBreakdownDonut` component, `CategoryBreakdownDonutProps { categoryAmounts: CategoryAmount[]; fixedVsVariable: FixedVsVariable; budgets: Budget[]; currency: string }` — consumed by Task 5 (`page.tsx`) and by the barrel (Task 5).

**Testing note:** no unit test for this file — it is a React component and the project has no React Testing Library/jsdom configured (same convention as the existing `CategoryBreakdown`/`ExpenseCharts`, never tested directly). Verified via build/lint (Step 2) + final manual verification by the user.

- [ ] **Step 1: Create the component**

Create `components/domain/expenses/category-breakdown-donut.tsx`:

```tsx
"use client";

/**
 * "Per categoria" ("By category") block: multi-level pie (inner layer: fixed/variable type, outer layer: category) and
 * legend with editable monthly budget, budget saturation percentage and percentage of the total spent in the
 * period. Merges the old "Fisse vs variabili" donut and the separate budget list into a single card. The
 * budget is saved on blur, same convention as add-account-form.tsx.
 */

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { CategoryAvatar } from "@/components/domain/categories";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { useUpsertBudgetMutation } from "@/lib/queries/budgets";
import type { CategoryAmount, FixedVsVariable } from "@/lib/calc/expenses";
import type { Budget } from "@/lib/db/schema/budgets";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { computeBudgetStats, sortCategoryAmounts } from "./category-breakdown-donut.utils";

const TYPE_CONFIG = {
  fissa: { label: "Fisse", color: "var(--chart-1)" },
  variabile: { label: "Variabili", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Saturation threshold above which the budget badge switches to the "over budget" style. */
const BUDGET_OVER_THRESHOLD_PCT = 100;

/** Formats the tooltip value (name + amount in currency) instead of ChartTooltipContent's numeric default. */
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

export interface CategoryBreakdownDonutProps {
  categoryAmounts: CategoryAmount[];
  fixedVsVariable: FixedVsVariable;
  budgets: Budget[];
  currency: string;
}

export function CategoryBreakdownDonut({
  categoryAmounts,
  fixedVsVariable,
  budgets,
  currency,
}: CategoryBreakdownDonutProps) {
  const upsertMutation = useUpsertBudgetMutation();
  const [pendingCategoryId, setPendingCategoryId] = React.useState<string | null>(null);
  const [errorCategoryId, setErrorCategoryId] = React.useState<string | null>(null);

  function budgetFor(categoryId: string): number {
    const budget = budgets.find((b) => b.categoryId === categoryId);
    return budget ? Number(budget.monthlyAmount) : 0;
  }

  /** Validates and sends the new budget for a category. Returns false if the value is invalid (no mutation sent). */
  function commitBudget(categoryId: string, raw: string): boolean {
    const normalized = raw.trim().replace(",", ".");
    const value = Number(normalized);
    if (normalized === "" || !Number.isFinite(value) || value < 0) return false;
    if (value === budgetFor(categoryId)) return true;

    setErrorCategoryId((prev) => (prev === categoryId ? null : prev));
    setPendingCategoryId(categoryId);
    upsertMutation.mutate(
      { categoryId, input: { monthlyAmount: value } },
      {
        onError: () => setErrorCategoryId(categoryId),
        onSuccess: () => setErrorCategoryId((prev) => (prev === categoryId ? null : prev)),
        onSettled: () => setPendingCategoryId((prev) => (prev === categoryId ? null : prev)),
      }
    );
    return true;
  }

  const sortedEntries = sortCategoryAmounts(categoryAmounts);
  const totalSpeso = categoryAmounts.reduce((sum, entry) => sum + entry.amount, 0);

  const innerData = [
    { key: "fissa", label: TYPE_CONFIG.fissa.label, value: fixedVsVariable.fissa, fill: "var(--color-fissa)" },
    {
      key: "variabile",
      label: TYPE_CONFIG.variabile.label,
      value: fixedVsVariable.variabile,
      fill: "var(--color-variabile)",
    },
  ];
  const outerData = sortedEntries
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      key: entry.categoryId,
      label: entry.name,
      value: entry.amount,
      fill: SWATCH_CHART_COLOR[entry.color as CategoryColor],
    }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Per categoria
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <ChartContainer config={TYPE_CONFIG} className="mx-auto aspect-square max-h-56 sm:mx-0">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            <Pie data={innerData} dataKey="value" nameKey="label" innerRadius={35} outerRadius={55}>
              {innerData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <Pie data={outerData} dataKey="value" nameKey="label" innerRadius={62} outerRadius={90}>
              {outerData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="divide-y divide-border">
          {sortedEntries.map((entry) => {
            const budgetAmount = budgetFor(entry.categoryId);
            const { saturazionePct, quotaPct } = computeBudgetStats(entry.amount, budgetAmount, totalSpeso);
            return (
              <CategoryLegendRow
                key={entry.categoryId}
                entry={entry}
                budgetAmount={budgetAmount}
                saturazionePct={saturazionePct}
                quotaPct={quotaPct}
                currency={currency}
                isSaving={pendingCategoryId === entry.categoryId}
                hasError={errorCategoryId === entry.categoryId}
                onCommitBudget={(raw) => commitBudget(entry.categoryId, raw)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface CategoryLegendRowProps {
  entry: CategoryAmount;
  budgetAmount: number;
  saturazionePct: number | null;
  quotaPct: number | null;
  currency: string;
  /** True while this category's budget is being saved. */
  isSaving: boolean;
  /** True if the last save attempt for this category failed. */
  hasError: boolean;
  /** Validates and sends the new value; returns false if invalid (the input must be restored). */
  onCommitBudget: (raw: string) => boolean;
}

/** Legend row: category avatar+name, amount spent, inline-editable budget, saturation/share badge. */
function CategoryLegendRow({
  entry,
  budgetAmount,
  saturazionePct,
  quotaPct,
  currency,
  isSaving,
  hasError,
  onCommitBudget,
}: CategoryLegendRowProps) {
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));

  React.useEffect(() => {
    setBudgetInput(String(budgetAmount));
  }, [budgetAmount]);

  function handleBlur() {
    const isValid = onCommitBudget(budgetInput);
    if (!isValid) {
      setBudgetInput(String(budgetAmount));
    }
  }

  const isOverBudget = saturazionePct !== null && saturazionePct >= BUDGET_OVER_THRESHOLD_PCT;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <CategoryAvatar
          color={entry.color as CategoryColor}
          icon={entry.icon as CategoryIcon}
          size={14}
          className="size-7"
        />
        <div>
          <p className="text-sm font-medium text-foreground">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(entry.amount, currency)} speso</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={isOverBudget ? "border-neg/40 bg-neg-soft text-neg" : ""}>
            {saturazionePct === null ? "—" : `${Math.round(saturazionePct)}% budget`}
          </Badge>
          <Badge variant="outline">{quotaPct === null ? "—" : `${Math.round(quotaPct)}% totale`}</Badge>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Budget</span>
          <Input
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            onBlur={handleBlur}
            disabled={isSaving}
            className="h-7 w-20 text-right text-sm"
            aria-label={`Budget mensile per ${entry.name}`}
          />
        </div>
        {hasError && <p className="text-sm text-destructive">Salvataggio non riuscito</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Check that the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (the file is not imported anywhere yet, but it must be internally consistent).

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.tsx
git commit -m "feat: aggiunge torta multilivello con legenda budget per Spese"
```

---

### Task 4: `ExpenseTrendChart` (rename of `ExpenseCharts`)

**Files:**
- Create: `components/domain/expenses/expense-trend-chart.tsx`
- Delete: `components/domain/expenses/expense-charts.tsx`

**Interfaces:**
- Produces: `ExpenseTrendChart` component, `ExpenseTrendChartProps { monthlyTrend: MonthlyTotal[]; currency: string }` — consumed by Task 5 (`page.tsx`) and by the barrel (Task 5).

**Testing note:** no unit test — same reason as Task 3 (React component, no rendering harness in the project).

- [ ] **Step 1: Create the new file, bar chart only**

Create `components/domain/expenses/expense-trend-chart.tsx`:

```tsx
"use client";

/** Spese chart: "Andamento ultimi 6 mesi" bars. */

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { MonthlyTotal } from "@/lib/calc/expenses";

const TREND_CONFIG = {
  total: { label: "Speso", color: "var(--chart-1)" },
} satisfies ChartConfig;

export interface ExpenseTrendChartProps {
  monthlyTrend: MonthlyTotal[];
  currency: string;
}

/** Formats the tooltip value (name + amount in currency) instead of ChartTooltipContent's numeric default. */
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

export function ExpenseTrendChart({ monthlyTrend, currency }: ExpenseTrendChartProps) {
  const trendData = monthlyTrend.map((month) => ({ label: month.label, total: month.total }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={TREND_CONFIG} className="max-h-56 w-full">
          <BarChart data={trendData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            <Bar dataKey="total" name={TREND_CONFIG.total.label} fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Delete the old file**

```bash
git rm components/domain/expenses/expense-charts.tsx
```

- [ ] **Step 3: Check that the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: errors expected only on `index.ts` and `page.tsx` (imports still pointing to the old `expense-charts`/`category-breakdown` — resolved in Task 5). If other unexpected errors appear, investigate before going on.

- [ ] **Step 4: Commit**

```bash
git add components/domain/expenses/expense-trend-chart.tsx
git commit -m "refactor: rinomina expense-charts in expense-trend-chart, solo bar chart"
```

---

### Task 5: Barrel, Spese page reordering and cleanup

**Files:**
- Modify: `components/domain/expenses/index.ts`
- Delete: `components/domain/expenses/category-breakdown.tsx`
- Modify: `app/(app)/spese/page.tsx`

**Interfaces:**
- Consumes: `CategoryBreakdownDonut`/`CategoryBreakdownDonutProps` (Task 3), `ExpenseTrendChart`/`ExpenseTrendChartProps` (Task 4).

- [ ] **Step 1: Update the barrel**

In `components/domain/expenses/index.ts`, replace:

```ts
export { CategoryBreakdown } from "./category-breakdown";
export type { CategoryBreakdownProps } from "./category-breakdown";
export { ExpenseCharts } from "./expense-charts";
export type { ExpenseChartsProps } from "./expense-charts";
```

with:

```ts
export { CategoryBreakdownDonut } from "./category-breakdown-donut";
export type { CategoryBreakdownDonutProps } from "./category-breakdown-donut";
export { ExpenseTrendChart } from "./expense-trend-chart";
export type { ExpenseTrendChartProps } from "./expense-trend-chart";
```

- [ ] **Step 2: Delete the old `category-breakdown.tsx`**

```bash
git rm components/domain/expenses/category-breakdown.tsx
```

- [ ] **Step 3: Update the import in `app/(app)/spese/page.tsx`**

Replace (lines 6-13):

```ts
import {
  AddTransactionForm,
  CategoryBreakdown,
  ExpenseCharts,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  TransactionRow,
} from "@/components/domain/expenses";
```

with:

```ts
import {
  AddTransactionForm,
  CategoryBreakdownDonut,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpenseTrendChart,
  TransactionRow,
} from "@/components/domain/expenses";
```

- [ ] **Step 4: Reorder the page body**

Replace the whole JSX block between `<>` and `</>` (roughly lines 122-176, inside the `else` of the main rendering) with:

```tsx
        <>
          <ExpensesKpiCards
            transactions={safeTransactions}
            budgets={safeBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
          />

          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(safeTransactions, safeCategories, period, referenceDate)}
            fixedVsVariable={computeFixedVsVariable(safeTransactions, safeCategories, period, referenceDate)}
            budgets={safeBudgets}
            currency={currency}
          />

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground">
              {(() => {
                const summary = computeSummary(safeTransactions, range);
                return (
                  <>
                    <span>Uscite: {formatCurrency(summary.uscite, currency)}</span>
                    <span>Escluse: {formatCurrency(summary.escluse, currency)}</span>
                    <span className="font-medium text-foreground">
                      Spese effettive: {formatCurrency(summary.speseEffettive, currency)}
                    </span>
                  </>
                );
              })()}
            </div>
            {transactionsInPeriod.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {showUncategorizedOnly
                  ? "Nessuna transazione da categorizzare in questo periodo."
                  : "Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto."}
              </p>
            ) : (
              transactionsInPeriod.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categories={safeCategories}
                  currency={currency}
                />
              ))
            )}
            <AddTransactionForm categories={safeCategories} currency={currency} />
          </Card>

          <ExpenseTrendChart
            monthlyTrend={compute6MonthTrend(safeTransactions, referenceDate)}
            currency={currency}
          />
        </>
```

- [ ] **Step 5: Check that the project compiles, lint passes and the build works**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

Run: `pnpm lint`
Expected: no errors

Run: `pnpm build`
Expected: build completed without errors

- [ ] **Step 6: Run the whole test suite**

Run: `pnpm test`
Expected: all tests pass (including the 9 new ones in `category-breakdown-donut.utils.test.ts`)

- [ ] **Step 7: Commit**

```bash
git add components/domain/expenses/index.ts "app/(app)/spese/page.tsx"
git commit -m "refactor: riordina pagina Spese, sostituisce blocco budget/donut con torta multilivello unificata"
```

---

## Manual verification (not automatable in this session)

As for the earlier features on this screen (see CLAUDE.md), no Postgres/Redis is available in the agentic sandbox: the final visual check in the browser is left to the user. Points to check:
- Angular alignment between the pie's inner layer (type) and outer layer (category).
- Legend readability on mobile (stacked column) and desktop (side by side).
- Inline budget editing unchanged (on-blur save, error state).
- Percentage badges in edge cases: budget at 0 (`—`), category with zero spending, saturation above 100% ("over budget" style).
- New section order: KPIs → pie+legend → transaction list → 6-month trend.

---

### Task 6: Scrollable legend and category icons in the slices (post-review addendum)

**Context:** after the final review (Tasks 1-5 approved, ready to merge), the user asked for two changes before merging, tested on the real component: with many categories the legend takes more vertical space than the chart, unbalancing the card; and they would like the category icon readable directly in the slices of the outer ring (hidden if the slice is too small). Design details in `docs/superpowers/specs/2026-07-22-spese-donut-riordino-design.md`, section "Addendum 2026-07-22".

**Files:**
- Modify: `components/domain/categories/index.ts` (barrel — adds the `ICON_MAP` export)
- Modify: `components/domain/expenses/category-breakdown-donut.tsx`

**Interfaces:**
- Consumes: `ICON_MAP: Record<CategoryIcon, LucideIcon>` (already exists in `components/domain/categories/category-avatar.tsx`, not yet exported from the barrel — this task exposes it).
- No new pure function, no new test file (the 5% filter uses the `percent` already computed by recharts, pure passthrough).

- [ ] **Step 1: Export `ICON_MAP` from the categories barrel**

In `components/domain/categories/index.ts`, replace the line:

```ts
export { CategoryAvatar } from "./category-avatar";
```

with:

```ts
export { CategoryAvatar, ICON_MAP } from "./category-avatar";
```

(The rest of the file, including `export type { CategoryAvatarProps } from "./category-avatar";` and the other exports, stays unchanged.)

- [ ] **Step 2: Update the imports in `category-breakdown-donut.tsx`**

Replace the import block (lines 10-24) with:

```tsx
import * as React from "react";
import { Package } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { PieLabelRenderProps } from "recharts";
import { CategoryAvatar, ICON_MAP } from "@/components/domain/categories";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { useUpsertBudgetMutation } from "@/lib/queries/budgets";
import type { CategoryAmount, FixedVsVariable } from "@/lib/calc/expenses";
import type { Budget } from "@/lib/db/schema/budgets";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { computeBudgetStats, sortCategoryAmounts } from "./category-breakdown-donut.utils";
```

- [ ] **Step 3: Add the icon rendering function, right after `BUDGET_OVER_THRESHOLD_PCT`**

Find this existing block:

```tsx
/** Saturation threshold above which the budget badge switches to the "over budget" style. */
const BUDGET_OVER_THRESHOLD_PCT = 100;
```

and add right after it (before `tooltipValueFormatter`):

```tsx

/** Threshold below which the category icon is not shown in the slice (too small to be readable). */
const PIE_ICON_MIN_PERCENT = 0.05;
/** Size in px of the category icon rendered inside a slice. */
const PIE_ICON_SIZE = 16;

/** Renders the category icon at the radial center of its slice in the outer ring; hides the icon below PIE_ICON_MIN_PERCENT. */
function renderCategoryIcon(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, payload } = props;
  if (percent === undefined || percent < PIE_ICON_MIN_PERCENT) return null;
  if (midAngle === undefined) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const icon = (payload as { icon?: CategoryIcon })?.icon;
  const Icon = icon ? (ICON_MAP[icon] ?? Package) : Package;

  return (
    <g transform={`translate(${x - PIE_ICON_SIZE / 2}, ${y - PIE_ICON_SIZE / 2})`}>
      <Icon size={PIE_ICON_SIZE} className="text-white" />
    </g>
  );
}
```

- [ ] **Step 4: Add `icon` to the outer layer data**

Replace:

```tsx
  const outerData = sortedEntries
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      key: entry.categoryId,
      label: entry.name,
      value: entry.amount,
      fill: SWATCH_CHART_COLOR[entry.color as CategoryColor],
    }));
```

with:

```tsx
  const outerData = sortedEntries
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      key: entry.categoryId,
      label: entry.name,
      value: entry.amount,
      fill: SWATCH_CHART_COLOR[entry.color as CategoryColor],
      icon: entry.icon as CategoryIcon,
    }));
```

- [ ] **Step 5: Enable the icons on the outer `<Pie>`**

Replace:

```tsx
            <Pie data={outerData} dataKey="value" nameKey="label" innerRadius={62} outerRadius={90}>
              {outerData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
```

with:

```tsx
            <Pie
              data={outerData}
              dataKey="value"
              nameKey="label"
              innerRadius={62}
              outerRadius={90}
              label={renderCategoryIcon}
              labelLine={false}
            >
              {outerData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
```

- [ ] **Step 6: Make the legend scrollable with a max height equal to the chart**

Replace:

```tsx
        <div className="divide-y divide-border">
```

with:

```tsx
        <div className="max-h-56 divide-y divide-border overflow-y-auto">
```

- [ ] **Step 7: Check that the project compiles, that lint does not get worse, and that the build works**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

Run: `pnpm lint`
Expected: the same pre-existing error count as before this task (2 `react-hooks/set-state-in-effect` errors, unrelated — see Task 5). No new errors introduced by this task.

Run: `pnpm build`
Expected: build completed without errors

- [ ] **Step 8: Run the whole test suite**

Run: `pnpm test`
Expected: same outcome as before this task (no changes to tested modules; the only 2 pre-existing failures remain `lib/gocardless/scheduler.test.ts`)

- [ ] **Step 9: Commit**

```bash
git add components/domain/categories/index.ts components/domain/expenses/category-breakdown-donut.tsx
git commit -m "feat: aggiunge icone categoria nelle fette della torta e legenda scrollabile in Spese"
```
