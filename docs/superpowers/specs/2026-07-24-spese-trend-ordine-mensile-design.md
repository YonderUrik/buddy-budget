# Last 6 months trend: top/order recomputed month by month

Date: 2026-07-24

## Context

Follows `docs/superpowers/specs/2026-07-23-spese-trend-stacked-categorie-design.md` (stacked bar by category in the 6-month trend), whose code has already been implemented and reviewed (worktree `spese-trend-stacked-categorie`, commits `d71c89b`/`6627165`/later fixes). That spec explicitly chose a ranking computed **only once over the whole six months**, so that each category would always occupy the same segment/colour/position from one month to the next.

Explicit user request in this session: "ordina i valori sempre in maniera decrescente" ("always sort the values in descending order"). Clarified with targeted questions that this means:
- the stacking order inside each single bar follows the value of **that specific month**, not the six-month total;
- also **which categories get their own segment** (not only the order) must be recomputed month by month, not fixed once on the six-month total;
- the segment with the month's highest spending goes at the **bottom** of the bar (next to the axis);
- **no fixed legend** under the chart (identification happens only via the tooltip, since composition and order change every month).

This spec **replaces** the "Data layer" and "UI component" sections of the 2026-07-23 spec (the rest — general context, motivation for the stacked bar, "Altro" (Other) aggregation for readability — stays valid).

## Data layer (`lib/calc/expenses.ts`)

Replaces `computeCategoryMonthlyTrend`/`MonthlyCategoryTotal`/`CategoryTrendSeries`/`CategoryMonthlyTrend` (introduced on 2026-07-23) with a new function with different semantics. No file other than `expense-trend-chart.tsx`/`page.tsx` consumes these types: clean removal, no need to deprecate.

```ts
export interface MonthlyStackSegment {
  key: string;    // categoryId, or "altro"
  name: string;   // category name, or "Altro"
  color: string;  // CategoryColor (shared palette), or the "altro" sentinel handled separately in the component
  amount: number; // positive actual spending for that month
}

export interface MonthlyCategoryStack {
  year: number;
  month: number;
  label: string;
  segments: MonthlyStackSegment[]; // descending order by amount; index 0 = highest amount = base of the bar
}

export function computeCategoryMonthlyStacks(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): MonthlyCategoryStack[]
```

Logic, for each of the 6 calendar months **independently of the others** (same iteration scheme as `compute6MonthTrend`/the previous function: `i` from 5 to 0, `addMonths(referenceDate, -i)`, full range `startOfMonth`..`endOfMonth`):

1. Compute that month's actual spending for each of the user's categories (`computeSummary` filtering by `categoryId`, the same helper reused).
2. Discard the categories with 0 spending that month.
3. Sort the remaining ones by amount descending; the first `topCount` become individual segments.
4. If there are categories beyond the first `topCount` (with spending > 0 that month), sum their spending into an aggregate segment `{ key: "altro", name: "Altro", color: "altro", amount: sum }`. If there are none, no "Altro" segment that month.
5. **Re-sort together** the individual segments + the possible "Altro" by amount descending (the "Altro" aggregate is not pinned at the end: if that month its sum exceeds one or more individual categories, it is placed higher in the ranking accordingly). This is the month's final `segments` array.

There is no longer a single ranking shared across months: the same category always has a consistent colour (`category.color` is a fixed property of the category) but may have a different position in the stack from one month to the next, and it may appear as its own segment in one month and end up inside "Altro" in another (or not appear at all if that month has 0 spending).

`compute6MonthTrend` stays unchanged (not touched by this change, as already guaranteed by the previous spec).

## UI component (`components/domain/expenses/expense-trend-chart.tsx`)

- Props: `monthlyStacks: MonthlyCategoryStack[]` (replaces `monthlyCategoryTrend: CategoryMonthlyTrend`), `currency: string` (unchanged).
- **No legend** under the chart (removed compared with the current implementation): with composition/order changing every month, a fixed legend would have no stable position→category mapping to show.
- Chart data, for "positional slot" rendering (necessary because recharts determines the stacking order from the declaration order of the `<Bar>` components, shared by **all** the bars of the chart — there is no native way to have a different order for each month with one `<Bar>` per category):
  - `maxSlots = Math.max(...months.map(m => m.segments.length))` (0 if no month has segments).
  - Each monthly data row carries, besides `label`: `pos{i}Amount`, `pos{i}Name`, `pos{i}Color`, `pos{i}Key` for `i` from 0 to `maxSlots - 1` (absent/`undefined` if that month has fewer segments than `maxSlots` — no segment rendered for that slot that month), plus the direct reference `segments` (the original array for that month, for the custom tooltip below).
  - One `<Bar dataKey={`pos${i}Amount`} stackId="trend">` for each slot `i` from 0 to `maxSlots - 1` (slot 0 declared first → base of the bar, consistent with "the highest at the bottom"). Per-month colour via `<Cell fill={...} />` per row (the same pattern already used in `CategoryBreakdownDonut`): `SWATCH_CHART_COLOR[posColor as CategoryColor]` for real categories, `var(--muted-foreground)` for "altro", `"transparent"` if the slot does not exist that month.
- **Custom tooltip** (not the `formatter` of `ChartTooltipContent`, which is meant for series with a fixed name — here the name per slot changes every month): a local component that receives `active`/`payload`/`label` from recharts, reads `payload[0]?.payload.segments` (the full data row of the hovered month) and renders one row for each real segment — the same visual style already in use elsewhere in the file (muted name + amount in currency, mono, no colour dot), with no empty rows for slots not used that month.
- `ChartContainer` receives a minimal/empty `config: ChartConfig` (`{}`): colours and names are entirely data-driven via `Cell`/custom tooltip, the static `chartConfig` map built from `series` is no longer needed.

## Integration (`app/(app)/spese/page.tsx`)

Replace `computeCategoryMonthlyTrend(filteredTransactions, safeCategories, referenceDate)` with `computeCategoryMonthlyStacks(filteredTransactions, safeCategories, referenceDate)`, passed as `monthlyStacks` to `ExpenseTrendChart`.

## Edge cases

- No spending in the six months (new user, or after a category filter): all months with `segments: []`, `maxSlots = 0`, no `<Bar>` rendered, empty bars — the same empty behaviour already present before.
- Category filter active on the page (`filterTransactions`, applied upstream): the transactions arrive already restricted to that category, so each month has at most one segment (that category), never "Altro" (no other categories exist in the filtered transactions).
- Month with fewer active categories than the six-month maximum: a visually lower bar that month (it reflects the lower real spending), not empty/ghost segments.
- "Altro" exceeding a "top" category that month: it is placed lower in the stack than that category (see point 5 of the data logic) — intentional behaviour, not a bug.

## Tests

They replace the `computeCategoryMonthlyTrend` tests (2026-07-23) in `lib/calc/expenses.test.ts`, for `computeCategoryMonthlyStacks`:
- independent ranking per month: two months with different categories/amounts produce different `segments` (composition and/or order), not a fixed ranking on the six-month total;
- "Altro" exceeding a top category in a specific month is placed accordingly in the `segments` array (not pinned at the end);
- month with fewer categories than `topCount`: shorter `segments`, no ghost keys;
- no categories/transactions: 6 months with `segments: []`;
- no regression on `compute6MonthTrend` (unchanged).

## Out of scope (explicitly excluded)

- Transition animation between one month's order and the next (recharts already animates height/position changes between renders by default; no request for custom behaviour).
- A visual indication in the chart that "this category changed position compared with last month" — out of scope, not requested.
- Removal of `compute6MonthTrend` (it stays for possible future uses of the total alone).
