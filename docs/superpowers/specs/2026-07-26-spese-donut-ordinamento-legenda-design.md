# Design: configurable ordering of the "Per categoria" legend

Date: 2026-07-26

## Context

`CategoryBreakdownDonut` (Spese screen, "Per categoria" — by category — block) shows a multi-level donut and a scrollable legend below/beside it. Today the legend uses `sortCategoryAmounts` (`components/domain/expenses/category-breakdown-donut.utils.ts`): it sorts by type (fixed before variable), then by amount spent descending within each group. There is no user control to change the ordering.

Request: add a user-chosen ordering (percentage of the total as the default, but also absolute value, budget, name), with asc/desc direction.

## Scope

- It concerns **only the legend** under the donut. The slices of the donut's outer ring stay ordered as today (`sortCategoryAmounts`, type then value) — no change to the donut itself.
- The grouping by type (fixed/variable) in the legend **is removed**: the new ordering produces a flat list, independent of the type.

## Component state

Two new `useState`s in `CategoryBreakdownDonut`:

```ts
type LegendSortCriterion = "percentuale" | "valore" | "budget" | "nome";
type LegendSortDirection = "asc" | "desc";

const [sortCriterion, setSortCriterion] = React.useState<LegendSortCriterion>("percentuale");
const [sortDirection, setSortDirection] = React.useState<LegendSortDirection>("desc");
```

Default per criterion when the selection changes (automatic reset of the direction, not manual):

| Criterion | Default direction |
|---|---|
| percentuale | desc |
| valore | desc |
| budget | desc |
| nome | asc |

Criterion change handler:

```ts
function handleCriterionChange(next: LegendSortCriterion) {
  setSortCriterion(next);
  setSortDirection(DEFAULT_DIRECTION[next]);
}
```

The asc/desc toggle is a separate button that inverts `sortDirection` without touching `sortCriterion`.

## Util: `sortLegendEntries`

New pure function in `category-breakdown-donut.utils.ts`, tested in isolation like the existing ones.

```ts
export interface LegendEntry extends CategoryAmount {
  budgetAmount: number;
  saturazionePct: number | null;
  quotaPct: number | null;
}

export function sortLegendEntries(
  entries: LegendEntry[],
  criterion: LegendSortCriterion,
  direction: LegendSortDirection
): LegendEntry[]
```

Criterion semantics:
- `"percentuale"` → `quotaPct` (percentage of the total spent, the existing "% totale" badge)
- `"valore"` → `amount` (absolute amount spent)
- `"budget"` → `saturazionePct` (budget saturation percentage, the existing "% budget" badge — not the budget amount set)
- `"nome"` → `name` (alphabetical, `localeCompare`)

Rule for `null` values (`saturazionePct`/`quotaPct` are null when budget=0 or total=0): they **always go at the bottom of the list**, regardless of the chosen direction. Comparison: if one of the two values is `null` and the other is not, the `null` one always loses (goes after); if both are `null`, stable order between them (no secondary criterion).

For the `"nome"` criterion there are no null values, direct comparison with `localeCompare("it")`.

## Component: pre-sort enrichment

Today `budgetFor`/`computeBudgetStats` are called inside the render loop for each row. To be able to sort by budget/percentage they must be computed **before** sorting, over all the categories:

```ts
const enrichedEntries: LegendEntry[] = categoryAmounts.map((entry) => {
  const budgetAmount = budgetFor(entry.categoryId);
  const { saturazionePct, quotaPct } = computeBudgetStats(entry.amount, budgetAmount, totalSpeso);
  return { ...entry, budgetAmount, saturazionePct, quotaPct };
});
const sortedLegendEntries = sortLegendEntries(enrichedEntries, sortCriterion, sortDirection);
```

The legend rendering (`sortedLegendEntries.map(...)`) passes the already computed `budgetAmount`/`saturazionePct`/`quotaPct` to `CategoryLegendRow` instead of recomputing them there — no double computation.

The existing `sortedEntries` variable (used for the donut's `outerData`) stays unchanged, based on `sortCategoryAmounts(categoryAmounts)` as today.

## UI

In the `CardHeader`, next to the "Per categoria" title:
- `Select` (shadcn component already used in the project) with the 4 options: "% sul totale", "Valore speso", "% budget", "Nome" ("% of total", "Amount spent", "% budget", "Name")
- Icon button (up/down arrow, `lucide-react`, consistent with the project's other icons) that inverts `sortDirection`, with an `aria-label` describing the current state (e.g. "Ordina decrescente" / "Ordina crescente" — "Sort descending" / "Sort ascending")

Layout: `CardHeader` goes from title-only to `flex items-center justify-between` to host the title on the left, controls on the right. On mobile the controls stay on the same row (they are compact: select + one icon).

## Testing

`category-breakdown-donut.utils.test.ts`: new cases for `sortLegendEntries` — 4 criteria × 2 directions, plus the case of `null` values always at the bottom (with both `sortCriterion: "percentuale"` and `"budget"`), plus stability when all are null.

No change to schema/API/routes — a fully client-side feature on data already available in the component.

## Out of scope

- Ordering of the donut's slices (stays as today).
- Persistence of the ordering preference (localStorage or similar) across sessions — not requested, it resets to "percentuale desc" on every mount.
