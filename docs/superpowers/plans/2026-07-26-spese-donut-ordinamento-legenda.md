# Configurable sorting of the "Per categoria" ("By category") legend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sorting control (percentage of total / amount spent / % of budget / name, asc or desc) to the legend of the "Per categoria" block in Spese (Expenses), without touching the order of the donut slices.

**Architecture:** New pure function `sortLegendEntries` in `category-breakdown-donut.utils.ts` (tested in isolation), plus local state (`sortCriterion`/`sortDirection`) and a pre-sort enrichment in `CategoryBreakdownDonut` that computes `budgetAmount`/`saturazionePct`/`quotaPct` for all categories before sorting (today computed inside the render loop). UI: `Select` + direction toggle button in the `CardHeader`.

**Tech Stack:** React 19 + TypeScript, vitest, shadcn components (`Select`), `lucide-react`.

## Global Constraints

- Visible strings in Italian (no i18n yet, see CLAUDE.md).
- No hardcoded colors/values outside the existing theme tokens — this feature introduces no new colors.
- The file `category-breakdown-donut.tsx` already exists and exceeds ~150 lines: reorganizing it is not in the scope of this plan, only extending it following the existing pattern (minimal JSDoc, exported types, no business logic outside these two files).

---

### Task 1: `sortLegendEntries` in `category-breakdown-donut.utils.ts`

**Files:**
- Modify: `components/domain/expenses/category-breakdown-donut.utils.ts`
- Test: `components/domain/expenses/category-breakdown-donut.utils.test.ts`

**Interfaces:**
- Consumes: `CategoryAmount` from `@/lib/calc/expenses` (already imported in the file).
- Produces:
  - `export type LegendSortCriterion = "percentuale" | "valore" | "budget" | "nome";`
  - `export type LegendSortDirection = "asc" | "desc";`
  - `export interface LegendEntry extends CategoryAmount { budgetAmount: number; saturazionePct: number | null; quotaPct: number | null; }`
  - `export function sortLegendEntries(entries: LegendEntry[], criterion: LegendSortCriterion, direction: LegendSortDirection): LegendEntry[]`
  - `export const LEGEND_SORT_DEFAULT_DIRECTION: Record<LegendSortCriterion, LegendSortDirection>` (map used by Task 2 to reset the direction when the criterion changes: `{ percentuale: "desc", valore: "desc", budget: "desc", nome: "asc" }`)

- [ ] **Step 1: Write the failing tests**

Add at the bottom of `components/domain/expenses/category-breakdown-donut.utils.test.ts` (import updated at the top: `import { computeBudgetStats, sortCategoryAmounts, sortLegendEntries, type LegendEntry } from "./category-breakdown-donut.utils";`):

```ts
function makeLegendEntry(overrides: Partial<LegendEntry>): LegendEntry {
  return {
    categoryId: "id",
    name: "Categoria",
    type: "variabile",
    amount: 0,
    color: "slate",
    icon: "package",
    budgetAmount: 0,
    saturazionePct: null,
    quotaPct: null,
    ...overrides,
  };
}

describe("sortLegendEntries", () => {
  it("ordina per percentuale sul totale decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", quotaPct: 10 }),
      makeLegendEntry({ categoryId: "high", quotaPct: 80 }),
    ];
    const result = sortLegendEntries(input, "percentuale", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per percentuale sul totale crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", quotaPct: 10 }),
      makeLegendEntry({ categoryId: "high", quotaPct: 80 }),
    ];
    const result = sortLegendEntries(input, "percentuale", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per valore speso decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", amount: 5 }),
      makeLegendEntry({ categoryId: "high", amount: 50 }),
    ];
    const result = sortLegendEntries(input, "valore", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per valore speso crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", amount: 5 }),
      makeLegendEntry({ categoryId: "high", amount: 50 }),
    ];
    const result = sortLegendEntries(input, "valore", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per saturazione budget decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", saturazionePct: 20 }),
      makeLegendEntry({ categoryId: "high", saturazionePct: 90 }),
    ];
    const result = sortLegendEntries(input, "budget", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per saturazione budget crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", saturazionePct: 20 }),
      makeLegendEntry({ categoryId: "high", saturazionePct: 90 }),
    ];
    const result = sortLegendEntries(input, "budget", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per nome A-Z", () => {
    const input = [
      makeLegendEntry({ categoryId: "z", name: "Zaino" }),
      makeLegendEntry({ categoryId: "a", name: "Affitto" }),
    ];
    const result = sortLegendEntries(input, "nome", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["a", "z"]);
  });

  it("ordina per nome Z-A", () => {
    const input = [
      makeLegendEntry({ categoryId: "z", name: "Zaino" }),
      makeLegendEntry({ categoryId: "a", name: "Affitto" }),
    ];
    const result = sortLegendEntries(input, "nome", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["z", "a"]);
  });

  it("mette le percentuali null sempre in fondo, indipendentemente dalla direzione", () => {
    const input = [
      makeLegendEntry({ categoryId: "no-budget", quotaPct: null }),
      makeLegendEntry({ categoryId: "has-value", quotaPct: 50 }),
    ];
    const desc = sortLegendEntries(input, "percentuale", "desc");
    expect(desc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
    const asc = sortLegendEntries(input, "percentuale", "asc");
    expect(asc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
  });

  it("mette le saturazioni budget null sempre in fondo, indipendentemente dalla direzione", () => {
    const input = [
      makeLegendEntry({ categoryId: "no-budget", saturazionePct: null }),
      makeLegendEntry({ categoryId: "has-value", saturazionePct: 50 }),
    ];
    const desc = sortLegendEntries(input, "budget", "desc");
    expect(desc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
    const asc = sortLegendEntries(input, "budget", "asc");
    expect(asc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
  });

  it("non genera errori quando tutti i valori sono null", () => {
    const input = [
      makeLegendEntry({ categoryId: "a", quotaPct: null }),
      makeLegendEntry({ categoryId: "b", quotaPct: null }),
    ];
    const result = sortLegendEntries(input, "percentuale", "desc");
    expect(result.map((e) => e.categoryId).sort()).toEqual(["a", "b"]);
  });

  it("non modifica l'array originale", () => {
    const input = [
      makeLegendEntry({ categoryId: "a", amount: 1 }),
      makeLegendEntry({ categoryId: "b", amount: 2 }),
    ];
    const originalOrder = input.map((e) => e.categoryId);
    sortLegendEntries(input, "valore", "desc");
    expect(input.map((e) => e.categoryId)).toEqual(originalOrder);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm vitest run components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: FAIL — `sortLegendEntries`/`LegendEntry` do not exist in the module yet.

- [ ] **Step 3: Implement `sortLegendEntries` in `category-breakdown-donut.utils.ts`**

Add at the bottom of the file (after `computeBudgetStats`):

```ts
export type LegendSortCriterion = "percentuale" | "valore" | "budget" | "nome";
export type LegendSortDirection = "asc" | "desc";

export const LEGEND_SORT_DEFAULT_DIRECTION: Record<LegendSortCriterion, LegendSortDirection> = {
  percentuale: "desc",
  valore: "desc",
  budget: "desc",
  nome: "asc",
};

export interface LegendEntry extends CategoryAmount {
  budgetAmount: number;
  saturazionePct: number | null;
  quotaPct: number | null;
}

/** Compares two nullable values: null always loses (goes to the bottom), regardless of the requested direction. */
function compareNullable(a: number | null, b: number | null, direction: LegendSortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "desc" ? b - a : a - b;
}

/**
 * Sorts the entries of the "Per categoria" legend according to the criterion chosen by the user (percentage of total,
 * amount spent, budget saturation or name). Does not touch the order of the donut slices (sortCategoryAmounts).
 * Null values (budget/total at 0) always stay at the bottom of the list whatever the direction.
 */
export function sortLegendEntries(
  entries: LegendEntry[],
  criterion: LegendSortCriterion,
  direction: LegendSortDirection
): LegendEntry[] {
  return [...entries].sort((a, b) => {
    switch (criterion) {
      case "percentuale":
        return compareNullable(a.quotaPct, b.quotaPct, direction);
      case "budget":
        return compareNullable(a.saturazionePct, b.saturazionePct, direction);
      case "valore":
        return direction === "desc" ? b.amount - a.amount : a.amount - b.amount;
      case "nome":
        return direction === "desc" ? b.name.localeCompare(a.name, "it") : a.name.localeCompare(b.name, "it");
    }
  });
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm vitest run components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: PASS (all tests, including the pre-existing ones for `sortCategoryAmounts`/`computeBudgetStats`).

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.utils.ts components/domain/expenses/category-breakdown-donut.utils.test.ts
git commit -m "feat: aggiungi sortLegendEntries per ordinamento configurabile legenda categorie"
```

---

### Task 2: Sorting UI in `CategoryBreakdownDonut`

**Files:**
- Modify: `components/domain/expenses/category-breakdown-donut.tsx`

**Interfaces:**
- Consumes from Task 1: `sortLegendEntries`, `LegendSortCriterion`, `LegendSortDirection`, `LegendEntry`, `LEGEND_SORT_DEFAULT_DIRECTION` from `./category-breakdown-donut.utils`.
- Produces: no new public export — only behavior of the already exported `CategoryBreakdownDonut` component.

- [ ] **Step 1: Update the import from `./category-breakdown-donut.utils`**

In `components/domain/expenses/category-breakdown-donut.tsx:27`, replace:

```ts
import { computeBudgetStats, sortCategoryAmounts } from "./category-breakdown-donut.utils";
```

with:

```ts
import {
  computeBudgetStats,
  LEGEND_SORT_DEFAULT_DIRECTION,
  sortCategoryAmounts,
  sortLegendEntries,
  type LegendEntry,
  type LegendSortCriterion,
  type LegendSortDirection,
} from "./category-breakdown-donut.utils";
```

Also add the import of the toggle icon and of `Select`, right below the existing imports (line 11 and line 17):

```ts
import { ArrowDownIcon, ArrowUpIcon, Package } from "lucide-react";
```

```ts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

And update the import of `Card`/`CardHeader`/... (line 18) to include `CardAction`, the container shadcn already provides for an action to the right of the title (grid `col-start-2`, avoids having to convert `CardHeader` from grid to flex):

```ts
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
```

- [ ] **Step 2: Add the sorting options and the state in the component**

Right after `const BUDGET_OVER_THRESHOLD_PCT = 100;` (line 35), add:

```ts
const LEGEND_SORT_OPTIONS: { value: LegendSortCriterion; label: string }[] = [
  { value: "percentuale", label: "% sul totale" },
  { value: "valore", label: "Valore speso" },
  { value: "budget", label: "% budget" },
  { value: "nome", label: "Nome" },
];
```

Inside `CategoryBreakdownDonut`, right after the existing `pendingCategoryId`/`errorCategoryId` states (after line 91), add:

```ts
const [sortCriterion, setSortCriterion] = React.useState<LegendSortCriterion>("percentuale");
const [sortDirection, setSortDirection] = React.useState<LegendSortDirection>("desc");

function handleCriterionChange(next: LegendSortCriterion) {
  setSortCriterion(next);
  setSortDirection(LEGEND_SORT_DEFAULT_DIRECTION[next]);
}
```

- [ ] **Step 3: Compute the enriched entries and sort them before rendering**

Keep the line `const sortedEntries = sortCategoryAmounts(categoryAmounts);` (line 118) unchanged (it is still needed for the donut's `outerData`) and add right after it (after the computation of `totalSpeso`, line 119):

```ts
const enrichedEntries: LegendEntry[] = categoryAmounts.map((entry) => {
  const budgetAmount = budgetFor(entry.categoryId);
  const { saturazionePct, quotaPct } = computeBudgetStats(entry.amount, budgetAmount, totalSpeso);
  return { ...entry, budgetAmount, saturazionePct, quotaPct };
});
const sortedLegendEntries = sortLegendEntries(enrichedEntries, sortCriterion, sortDirection);
```

- [ ] **Step 4: Update the scroll effect to use the new list**

In the `React.useEffect` that depends on `sortedEntries.length` (lines 133-144), change the dependency array from `[checkScroll, sortedEntries.length]` to `[checkScroll, sortedLegendEntries.length]` (the list that actually determines the scrollable height is the legend's one).

- [ ] **Step 5: Replace the legend rendering**

In the `{sortedEntries.map((entry) => { ... })}` block inside the `div` with `ref={scrollRef}` (lines 219-235), replace `sortedEntries.map` with `sortedLegendEntries.map` and use the already computed values instead of calling `budgetFor`/`computeBudgetStats` again:

```tsx
{sortedLegendEntries.map((entry) => (
  <CategoryLegendRow
    key={entry.categoryId}
    entry={entry}
    budgetAmount={entry.budgetAmount}
    saturazionePct={entry.saturazionePct}
    quotaPct={entry.quotaPct}
    currency={currency}
    isSaving={pendingCategoryId === entry.categoryId}
    hasError={errorCategoryId === entry.categoryId}
    onCommitBudget={(raw) => commitBudget(entry.categoryId, raw)}
  />
))}
```

- [ ] **Step 6: Add the sorting controls in the `CardHeader`**

Replace the existing `CardHeader` block (lines 168-172):

```tsx
<CardHeader className="pt-4">
  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    Per categoria
  </CardTitle>
</CardHeader>
```

with (uses `CardAction`, the slot shadcn already provides for an action to the right of the title inside a `CardHeader` that stays a grid — no conversion to flex):

```tsx
<CardHeader className="pt-4">
  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    Per categoria
  </CardTitle>
  <CardAction className="flex items-center gap-1">
    <Select value={sortCriterion} onValueChange={(value) => handleCriterionChange(value as LegendSortCriterion)}>
      <SelectTrigger size="sm" className="w-36">
        <SelectValue>{(value: LegendSortCriterion) => LEGEND_SORT_OPTIONS.find((o) => o.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LEGEND_SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <button
      type="button"
      onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
      aria-label={sortDirection === "desc" ? "Ordina crescente" : "Ordina decrescente"}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {sortDirection === "desc" ? <ArrowDownIcon className="size-4" /> : <ArrowUpIcon className="size-4" />}
    </button>
  </CardAction>
</CardHeader>
```

- [ ] **Step 7: Verify build and tests**

Run: `pnpm tsc --noEmit`
Expected: no type errors.

Run: `pnpm vitest run components/domain/expenses`
Expected: PASS on all the tests of the folder (including those of Task 1).

Run: `pnpm lint`
Expected: no new errors introduced by this file (the pre-existing `react-hooks/set-state-in-effect` debt on `CategoryLegendRow`/`theme-toggle.tsx`, already known and out of scope, may remain).

- [ ] **Step 8: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.tsx
git commit -m "feat: select ordinamento + toggle direzione nella legenda Per categoria"
```

---

## Manual verification (outside the tasks, to be done by the user)

No Postgres/Redis available in the agentic sandbox (known constraint, see CLAUDE.md). To check in a real browser after the merge:
- The default on opening is "% sul totale" descending.
- Changing criterion resets the direction to the expected default (name → A-Z, others → descending).
- The toggle correctly inverts the direction for the current criterion.
- Categories with budget 0 (percentage "—") always end up at the bottom when the criterion is "% budget", whatever the direction.
- The donut slices do not change order/color when the legend sorting is changed.
