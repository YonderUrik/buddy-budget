# Spese — filter by category and by text

Date: 2026-07-22

## Goal

In the Spese (Expenses) screen, allow filtering transactions by category and/or by free text (description). The filter is **global**: it recomputes not only the transaction list but also the KPIs, the "Per categoria" (by category) multi-level pie and the "Andamento 6 mesi" (6-month trend) chart, for a consistent end-to-end view of the filtered data.

## Architecture / data flow

New local state in `app/(app)/spese/page.tsx`:

```ts
const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null); // null = all categories
const [searchText, setSearchText] = React.useState("");
```

New pure function in `lib/calc/expenses.ts`:

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

Behaviour:
- `categoryId` not null → keeps only transactions whose `categoryId` is exactly equal.
- `searchText` not empty (after trim) → keeps only transactions whose `description` contains the string, case-insensitive comparison (`.toLocaleLowerCase()`).
- Both filters apply in AND.
- No filter set → passthrough (same array, current behaviour).

`page.tsx` computes `filteredTransactions = filterTransactions(safeTransactions, { categoryId: categoryFilter, searchText })` and passes it **instead of** `safeTransactions` to:
- `ExpensesKpiCards` (prop `transactions`)
- `computeCategoryBreakdown` / `computeFixedVsVariable` (for `CategoryBreakdownDonut`)
- `compute6MonthTrend` (for `ExpenseTrendChart`)
- `computeSummary` (outflows/excluded/actual spending summary above the list)
- the base for `transactionsInPeriodAll` → transaction list (the rest of the pipeline unchanged: period filter, then the optional `showUncategorizedOnly`)

**Budget scoping**: when `categoryFilter` is set, `ExpensesKpiCards` receives `budgets: safeBudgets.filter(b => b.categoryId === categoryFilter)` instead of `safeBudgets` — so "Budget rimanente" (remaining budget) compares the filtered spending with the budget of the selected category only. No signature change to the functions in `lib/calc/expenses.ts`, only what `page.tsx` passes to them.

The existing `showUncategorizedOnly` toggle ("Da categorizzare" chip) **stays independent**, applied in AND after `filterTransactions`, exactly as today it is applied after the period filter. No unification of the two mechanisms (explicit choice: combining a specific category + "Da categorizzare" can give an empty list, accepted as a known edge case).

## UI component

New `components/domain/expenses/expenses-filter-bar.tsx`:

```ts
export interface ExpensesFilterBarProps {
  categories: Category[];
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
}
```

- Category `Select`: a "Tutte le categorie" ("All categories") option (internal sentinel value, mapped to `null` externally) + one `SelectItem` per category with `CategoryAvatar` + name, the same visual pattern already used in `TransactionRow` for the row's category select.
- Text `Input`: placeholder "Cerca per descrizione..." ("Search by description..."), direct `onChange` (no debounce — client-side filter on a dataset already in memory, no network call).
- No hardcoded dependencies: everything comes from props, reusable component.
- Exported from the barrel `components/domain/expenses/index.ts`.

Placement in `page.tsx`: a new row under the existing header (title/period/categories link/uncategorised chip), above the KPI cards.

## Edge cases

- Active filters with zero results in the period → updated list message: if `categoryFilter !== null || searchText.trim() !== ""`, show "Nessuna transazione corrisponde ai filtri applicati in questo periodo" ("No transaction matches the filters applied in this period") instead of the current message "Nessuna transazione in questo periodo..." ("No transactions in this period...").
- Filtered category with no budget set → KPI `budgetTotale` = 0, `budgetRimanente` = `-spent` if there is spending: existing behaviour of the formula, no special case to add.
- Resetting filters: no dedicated button — go back to "Tutte le categorie" from the select and clear the text input manually.

## Tests

Unit tests in `lib/calc/expenses.test.ts` for `filterTransactions`:
- no filter → passthrough
- category only
- text only (case-insensitive, substring)
- category + text combined (AND)
- no match → empty array

## Out of scope

- Filter by amount range or by source (auto/manual) — not requested.
- Multi-selection of categories — explicitly decided single selection.
- Persistence of filters across sessions/URL — not requested, local state of the page component.
