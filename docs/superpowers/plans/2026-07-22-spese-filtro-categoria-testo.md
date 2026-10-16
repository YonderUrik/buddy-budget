# Spese — category/text filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add to the Spese ("Expenses") screen a filter by category (single selection) and by text (description), which globally recomputes KPIs, the "Per categoria" ("By category") pie, the "Andamento 6 mesi" ("6-month trend") chart and the transaction list.

**Architecture:** New pure function `filterTransactions` in `lib/calc/expenses.ts` applied upstream of all existing calculation functions in `app/(app)/spese/page.tsx`. New controlled component `ExpensesFilterBar` (category select + text input) in `components/domain/expenses/`. No changes to DB schema, API, or existing calculation functions.

**Tech Stack:** Next.js App Router, TypeScript, React (client component), vitest for tests, shadcn `Select`/`Input` components.

## Global Constraints

- All visible strings in Italian (no i18n yet).
- No hardcoded colors/radii: use existing Tailwind classes/theme tokens.
- Minimal JSDoc (one `/**` line) on every public component/function.
- Domain components compose `components/ui/` primitives, no business logic in `app/*/page.tsx` files beyond the orchestration already there.
- The `components/domain/expenses/index.ts` barrel is the only external import point for these components.

---

### Task 1: `filterTransactions` — pure function + tests

**Files:**
- Modify: `lib/calc/expenses.ts`
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: `Transaction` type from `@/lib/db/schema/transactions` (fields used: `categoryId: string`, `description: string`), already imported in `lib/calc/expenses.ts`.
- Produces:
  ```ts
  export interface TransactionFilter {
    categoryId: string | null;
    searchText: string;
  }
  export function filterTransactions(
    transactions: Transaction[],
    filter: TransactionFilter
  ): Transaction[]
  ```
  Used by Task 3 in `app/(app)/spese/page.tsx`.

- [ ] **Step 1: Write the failing tests**

Add at the bottom of `lib/calc/expenses.test.ts` (after the last existing `describe`), reusing the `makeTransaction` helper already in the file:

```ts
describe("filterTransactions", () => {
  it("senza filtri restituisce tutte le transazioni invariate", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "" });
    expect(result).toEqual(transactions);
  });

  it("filtra per categoryId esatto", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: "category-2", searchText: "" });
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });

  it("filtra per testo, substring case-insensitive sulla descrizione", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare Esselunga" }),
      makeTransaction({ id: "t2", categoryId: "category-1", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "esselunga" });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("combina categoria e testo in AND", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa Esselunga" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Spesa Esselunga" }),
    ];
    const result = filterTransactions(transactions, { categoryId: "category-1", searchText: "esselunga" });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("nessun match restituisce array vuoto", () => {
    const transactions = [makeTransaction({ id: "t1", description: "Cinema" })];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "ristorante" });
    expect(result).toEqual([]);
  });

  it("ignora spazi bianchi attorno al testo di ricerca", () => {
    const transactions = [makeTransaction({ id: "t1", description: "Cinema" })];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "  cinema  " });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });
});
```

Add `filterTransactions` to the existing import from `"./expenses"` at the top of the test file.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `filterTransactions is not a function` (or an import type error).

- [ ] **Step 3: Implement `filterTransactions`**

Add at the bottom of `lib/calc/expenses.ts`:

```ts
export interface TransactionFilter {
  categoryId: string | null;
  searchText: string;
}

/** Filters transactions by exact category and/or case-insensitive substring on the description, in AND. */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[] {
  const normalizedSearch = filter.searchText.trim().toLocaleLowerCase();
  return transactions.filter((t) => {
    if (filter.categoryId !== null && t.categoryId !== filter.categoryId) return false;
    if (normalizedSearch !== "" && !t.description.toLocaleLowerCase().includes(normalizedSearch)) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS, all tests including the new `filterTransactions` block.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiunge filterTransactions per filtro categoria/testo in Spese"
```

---

### Task 2: `ExpensesFilterBar` — UI component

**Files:**
- Create: `components/domain/expenses/expenses-filter-bar.tsx`
- Modify: `components/domain/expenses/index.ts`

**Interfaces:**
- Consumes: `Category` type from `@/lib/db/schema/categories` (fields `id`, `name`, `color`, `icon`); `CategoryAvatar` from `@/components/domain/categories`; `CategoryColor`/`CategoryIcon` from `@/lib/validation/categories`; `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` from `@/components/ui/select`; `Input` from `@/components/ui/input`.
- Produces:
  ```ts
  export interface ExpensesFilterBarProps {
    categories: Category[];
    categoryId: string | null;
    onCategoryChange: (categoryId: string | null) => void;
    searchText: string;
    onSearchTextChange: (text: string) => void;
  }
  export function ExpensesFilterBar(props: ExpensesFilterBarProps): JSX.Element
  ```
  Used by Task 3 in `app/(app)/spese/page.tsx`.

No automated test for this component (no existing tests for the other pure UI components in this folder, e.g. `expenses-period-selector.tsx`, `transaction-row.tsx` — a pattern consistent with the codebase). Manual verification planned at the end of the plan.

- [ ] **Step 1: Create the component**

`components/domain/expenses/expenses-filter-bar.tsx`:

```tsx
"use client";

/** Filter bar of the Spese screen: single category select + text search on the description, both controlled. */

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryAvatar } from "@/components/domain/categories";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

const ALL_CATEGORIES_VALUE = "__all__";

export interface ExpensesFilterBarProps {
  categories: Category[];
  /** null = no active category filter ("Tutte le categorie"). */
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
}

export function ExpensesFilterBar({
  categories,
  categoryId,
  onCategoryChange,
  searchText,
  onSearchTextChange,
}: ExpensesFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={categoryId ?? ALL_CATEGORIES_VALUE}
        onValueChange={(value) => onCategoryChange(value === ALL_CATEGORIES_VALUE ? null : value)}
      >
        <SelectTrigger size="sm" className="w-56">
          <SelectValue>
            {(value: string) => {
              if (value === ALL_CATEGORIES_VALUE) return "Tutte le categorie";
              const selected = categories.find((c) => c.id === value);
              if (!selected) return "Tutte le categorie";
              return (
                <span className="flex items-center gap-1.5">
                  <CategoryAvatar
                    color={selected.color as CategoryColor}
                    icon={selected.icon as CategoryIcon}
                    size={10}
                    className="size-4"
                  />
                  {selected.name}
                </span>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES_VALUE}>Tutte le categorie</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <span className="flex items-center gap-1.5">
                <CategoryAvatar
                  color={category.color as CategoryColor}
                  icon={category.icon as CategoryIcon}
                  size={10}
                  className="size-4"
                />
                {category.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={searchText}
        onChange={(e) => onSearchTextChange(e.target.value)}
        placeholder="Cerca per descrizione..."
        className="h-8 w-56"
        aria-label="Cerca transazioni per descrizione"
      />
    </div>
  );
}
```

- [ ] **Step 2: Export from the barrel**

Add to `components/domain/expenses/index.ts` (after the `ExpensesPeriodSelector` export, keeping the existing approximate alphabetical order):

```ts
export { ExpensesFilterBar } from "./expenses-filter-bar";
export type { ExpensesFilterBarProps } from "./expenses-filter-bar";
```

- [ ] **Step 3: Check build/lint**

Run: `pnpm build`
Expected: build completes without TypeScript errors (the component is not yet used in any page, but it must compile in isolation).

- [ ] **Step 4: Commit**

```bash
git add components/domain/expenses/expenses-filter-bar.tsx components/domain/expenses/index.ts
git commit -m "feat: aggiunge ExpensesFilterBar (select categoria + ricerca testo)"
```

---

### Task 3: integration in `app/(app)/spese/page.tsx`

**Files:**
- Modify: `app/(app)/spese/page.tsx`

**Interfaces:**
- Consumes: `filterTransactions`/`TransactionFilter` from `@/lib/calc/expenses` (Task 1); `ExpensesFilterBar`/`ExpensesFilterBarProps` from `@/components/domain/expenses` (Task 2).
- Produces: no new public interface (route file, terminal orchestration).

- [ ] **Step 1: Add filter state and import the new symbols**

In `app/(app)/spese/page.tsx`, update the import from `@/components/domain/expenses` (lines 6-13) adding `ExpensesFilterBar`:

```ts
import {
  AddTransactionForm,
  CategoryBreakdownDonut,
  ExpensesFilterBar,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpenseTrendChart,
  TransactionRow,
} from "@/components/domain/expenses";
```

Update the import from `@/lib/calc/expenses` (lines 16-23) adding `filterTransactions`:

```ts
import {
  compute6MonthTrend,
  computeCategoryBreakdown,
  computeFixedVsVariable,
  computeSummary,
  filterTransactions,
  getPeriodRange,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
```

Add the new state right after `showUncategorizedOnly` (line 45):

```ts
const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
const [searchText, setSearchText] = React.useState("");
```

- [ ] **Step 2: Compute `filteredTransactions` and `filteredBudgets`, replace the downstream uses of `safeTransactions`/`safeBudgets`**

Right after the line `const safeBudgets = budgets ?? [];` (line 54), add:

```ts
const filteredTransactions = filterTransactions(safeTransactions, {
  categoryId: categoryFilter,
  searchText,
});
const filteredBudgets = categoryFilter
  ? safeBudgets.filter((b) => b.categoryId === categoryFilter)
  : safeBudgets;
```

In the component body (lines 56-69, the `fallbackCategoryIds`/`transactionsInPeriodAll`/`uncategorizedCount`/`transactionsInPeriod` block), replace every reference to `safeTransactions` with `filteredTransactions`:

```ts
const fallbackCategoryIds = new Set(
  safeCategories.filter((c) => c.isFallback).map((c) => c.id)
);

const range = getPeriodRange(period, referenceDate);
const transactionsInPeriodAll = filteredTransactions.filter(
  (t) => t.date >= toDateString(range.from) && t.date <= toDateString(range.to)
);
const uncategorizedCount = transactionsInPeriodAll.filter(
  (t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId)
).length;
const transactionsInPeriod = showUncategorizedOnly
  ? transactionsInPeriodAll.filter((t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId))
  : transactionsInPeriodAll;

const hasActiveFilter = categoryFilter !== null || searchText.trim() !== "";
```

- [ ] **Step 3: Insert `ExpensesFilterBar` in the JSX and pass `filteredTransactions`/`filteredBudgets` to the downstream components**

Right after the header block (after the closing `</div>` on line 106, before `{isLoading ? (` on line 108), add:

```tsx
<ExpensesFilterBar
  categories={safeCategories}
  categoryId={categoryFilter}
  onCategoryChange={setCategoryFilter}
  searchText={searchText}
  onSearchTextChange={setSearchText}
/>
```

Update the existing calls in the `else` block (lines 122-176):

- `ExpensesKpiCards`: replace `transactions={safeTransactions}` with `transactions={filteredTransactions}` and `budgets={safeBudgets}` with `budgets={filteredBudgets}`.
- `CategoryBreakdownDonut`: replace `computeCategoryBreakdown(safeTransactions, ...)` with `computeCategoryBreakdown(filteredTransactions, ...)` and `computeFixedVsVariable(safeTransactions, ...)` with `computeFixedVsVariable(filteredTransactions, ...)`.
- The outgoing/excluded/actual expenses summary above the list: replace `computeSummary(safeTransactions, range)` with `computeSummary(filteredTransactions, range)`.
- `ExpenseTrendChart`: replace `compute6MonthTrend(safeTransactions, referenceDate)` with `compute6MonthTrend(filteredTransactions, referenceDate)`.

- [ ] **Step 4: Update the empty-list message**

Replace the existing empty-message block (lines 153-158):

```tsx
{transactionsInPeriod.length === 0 ? (
  <p className="p-6 text-sm text-muted-foreground">
    {showUncategorizedOnly
      ? "Nessuna transazione da categorizzare in questo periodo."
      : "Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto."}
  </p>
) : (
```

with:

```tsx
{transactionsInPeriod.length === 0 ? (
  <p className="p-6 text-sm text-muted-foreground">
    {showUncategorizedOnly
      ? "Nessuna transazione da categorizzare in questo periodo."
      : hasActiveFilter
        ? "Nessuna transazione corrisponde ai filtri applicati in questo periodo."
        : "Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto."}
  </p>
) : (
```

- [ ] **Step 5: Check build and lint**

Run: `pnpm build`
Expected: build completes without TypeScript errors.

Run: `pnpm lint`
Expected: no new errors introduced (the 2 pre-existing `react-hooks/set-state-in-effect` errors documented in `CLAUDE.md` stay unchanged).

- [ ] **Step 6: Run the whole test suite**

Run: `pnpm exec vitest run`
Expected: PASS, all tests including the new `filterTransactions` block from Task 1.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/spese/page.tsx
git commit -m "feat: integra filtro categoria/testo nella pagina Spese"
```

---

## Final manual verification (outside the automatable tasks)

No Postgres/Redis available in the agentic sandbox (the same limitation already documented in `CLAUDE.md` for the earlier Spese features). To be verified manually in the browser by the user at the end of the plan:

- Select a category from the filter → list, KPIs, pie and trend update to that category only; "Budget rimanente" ("Remaining budget") shows the selected category's budget.
- Type search text → list/KPIs/pie/trend filter by case-insensitive substring on the description.
- Combine category + text → AND filter.
- Go back to "Tutte le categorie" ("All categories") and clear the text → the full view is restored.
- No results with active filters → message "Nessuna transazione corrisponde ai filtri applicati in questo periodo" ("No transaction matches the filters applied in this period").
