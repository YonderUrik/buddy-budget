# Spese: multi-level pie chart and section reordering — design

Date: 2026-07-22

## Context

The Spese (Expenses) screen (`app/(app)/spese/page.tsx`) today shows, in order: KPI cards, the "Per categoria" (by category) block (editable budget list, `CategoryBreakdown`), two side-by-side charts (`ExpenseCharts`: "Fisse vs variabili" — fixed vs variable — donut + "Andamento ultimi 6 mesi" — last 6 months trend — bars), transaction list, "+ Aggiungi" (add) form.

User feedback after manual testing:
1. The transaction list as the last element does not work well visually.
2. The "Fisse vs variabili" donut and the per-category budget block are disconnected: you see the type of spending but not immediately how much was spent per category against the budget, without scrolling the page.

Goal: a more immediate visual impact on "where the money went", with budgets/percentages always visible in the same block as the chart, and a transaction list not relegated to the bottom.

## Component architecture

- **Removed**: `components/domain/expenses/category-breakdown.tsx` (the whole file), and the "Fisse vs variabili" part of `components/domain/expenses/expense-charts.tsx`.
- **New**: `components/domain/expenses/category-breakdown-donut.tsx` — unifies the multi-level pie (type → category) and the legend with inline-editable budget + percentages. Replaces both `CategoryBreakdown` and the `ExpenseCharts` donut.
- **Renamed**: `expense-charts.tsx` → `expense-trend-chart.tsx`, contains only the "Andamento ultimi 6 mesi" bar chart (the plural name "charts" no longer makes sense with a single chart inside).
- Update `components/domain/expenses/index.ts` (barrel) with the new exports, remove the obsolete ones.
- **No new calculation function**: `computeCategoryBreakdown` (already exposes `categoryId`, `name`, `type`, `amount`, `color`, `icon`) and `computeFixedVsVariable` (sums by type) in `lib/calc/expenses.ts` are enough. The total spent in the period for the "% of total" calculation is obtained by summing `amount` over all the returned `CategoryAmount`s (the same aggregate value as the "spent" KPI).

## Multi-level pie chart

Two recharts `<Pie>`s nested in the same `<PieChart>` (standard nested-donut pattern, consistent with the shadcn `ChartContainer`/`ChartTooltip` already in use):

- **Inner layer**: 2 slices, fixed/variable, from `FixedVsVariable`. Fixed neutral colours (`--chart-1` fixed, `--chart-2` variable — the same tokens already used today in the existing donut).
- **Outer layer**: one slice for each category with `amount > 0` in the selected period. Colour = the category's own colour (`entry.color`, the same one used by `CategoryAvatar` elsewhere in the app). The outer layer's `innerRadius` = the inner layer's `outerRadius` (concentric donut, no gap between the two rings).
- Categories with `amount === 0` **do not generate a slice** in the outer layer (a useless invisible slice) but **still appear in the legend** (see below).
- **Ordering**: the outer layer's data array must be sorted by `type` (all "fissa" contiguous, then all "variabile") and, within each group, by `amount` descending. Necessary because recharts does not reorder a `Pie`'s data — the angular alignment between the outer and inner layers depends on the array order. The same ordering must be applied to the legend rows, for readability (pie and legend match visually).
- Tooltip: reuses the `tooltipValueFormatter` pattern already present in `expense-charts.tsx` (name + amount formatted in the currency), extended to also show the type when hovering over the inner layer.

Rejected alternative: drawing the rings by hand with SVG for more control — rejected because it adds nothing over recharts' nested-Pie pattern and would break consistency with the `ChartContainer`/`ChartTooltip` already used throughout the Spese section.

## Legend and card layout

A single card (replaces both the old `CategoryBreakdown` card and the donut card in `ExpenseCharts`):

- **Desktop**: chart on the left (fixed-width column, `aspect-square max-h-56` as today), legend on the right taking the remaining space.
- **Mobile**: chart above, legend below, stacked.
- **Each legend row** (one per category, same ordering as the pie's outer layer):
  - `CategoryAvatar` (category colour/icon) + name — direct reuse of the existing markup in `CategoryBreakdownRow`.
  - Amount spent in the period (text, as today).
  - Inline-editable monthly budget input: **as-is reuse** of the existing logic in `CategoryBreakdownRow` (commit on blur, saving/error state via `useUpsertBudgetMutation`, validation: empty/non-numeric/negative rejected, previous value restored).
  - **Budget saturation % badge** = `amount / budgetAmount × 100`, rounded. If `budgetAmount === 0` → text `—` (no division by zero). Badge style: `text-neg`/`bg-neg-soft` if ≥ 100% (over budget, consistent with the neg/pos tokens already used for negative amounts elsewhere in the app), otherwise neutral style (`text-muted-foreground`).
  - **% of total spent badge** = `amount / totalSpentInPeriod × 100`, rounded. If the total spent in the period is 0 → `—`.
- Categories with `amount === 0` still show their row (useful to see the assigned budget even if nothing has been spent in this period yet), with "€0 speso" ("€0 spent") and percentages at `—` where they cannot be computed (0/budget = 0% can still be computed and is shown normally; only the 0/0 case on the total changes, if there is no spending at all in the period).

## Page reordering

New order in `app/(app)/spese/page.tsx`:

1. Header (title, period range, "Gestisci categorie" link, "Da categorizzare" chip, period selector) — unchanged.
2. `ExpensesKpiCards` — unchanged.
3. **New**: `CategoryBreakdownDonut` (multi-level pie + budget/percentage legend) — replaces both the old `CategoryBreakdown` and the `ExpenseCharts` donut card.
4. **Moved**: the transaction list card (with the outflows/excluded/actual spending summary at the top) + `AddTransactionForm` at the end — same internal structure as today, only its position in the page changed (from last to here).
5. **Renamed**: the `ExpenseTrendChart` card (formerly `ExpenseCharts`, only the "Andamento ultimi 6 mesi" bar chart) — stays on its own, no longer side by side with the donut.

## Testing

- No new pure calculation module to test (no change to `lib/calc/expenses.ts`).
- Add tests for the ordering/aggregation of the new component's data if the ordering/percentage logic is extracted into a pure function separate from the React component (to be evaluated during planning — if it stays inline in the component, cover it with manual verification/build instead of unit tests, following the same convention already used for the existing `CategoryBreakdown`, which has no dedicated tests).
- Manual verification in the browser required for: angular alignment of inner/outer pie, legend readability on mobile, budget editing unchanged, percentage badges with edge cases (budget 0, spending 0, saturation >100%).

## Out of scope

- No change to `lib/calc/expenses.ts` or to the API routes.
- No change to the "Dividi" mechanism (`SplitSlider`) or to `TransactionRow`.
- No change to the separate Budget section (deferred, see `CLAUDE.md` — "In corso ora").

## Addendum 2026-07-22 — scrollable legend and icons in the slices

User feedback after the first implementation (5/5 tasks, final review approved, not merged yet): with many categories the legend takes up much more vertical space than the chart, unbalancing the card; moreover, the category icon (already visible in the legend via `CategoryAvatar`) would be useful to read directly in the outer ring's slices for more immediate recognition.

Two changes, both confined to `category-breakdown-donut.tsx`:

1. **Legend with maximum height and internal scroll**: the legend container (`div.divide-y` in `CategoryBreakdownDonut`) gets `max-h-56 overflow-y-auto` (224px, the same height as the `aspect-square max-h-56` chart), so the chart always keeps the same visual proportion relative to the legend regardless of the number of categories. Native browser scrollbar, no new custom style (no need to replicate the dedicated scrollbar treatment of `.sidebar-nav` for this case).
2. **Category icon in the outer ring's slices**: through recharts' `label` prop on the outer `<Pie>` (custom function, not the default), which receives `cx`, `cy`, `midAngle`, `innerRadius`, `outerRadius`, `percent`, `payload` for each slice. The function:
   - Computes the position at the radial centre of the slice: `radius = innerRadius + (outerRadius - innerRadius) / 2`, then `x`/`y` from `cx`/`cy` + `radius * cos/sin(-midAngle in radians)`.
   - Hides the icon (returns `null`) if `percent < 0.05` (5% threshold on the total — recharts' `percent` for the outer layer is already `amount / outerLayerSum`, and the outer layer's sum coincides with the total spent in the period since it is filtered to `amount > 0`, so it is the same calculation base as the "% of total" already shown in the legend).
   - Renders the category's Lucide icon (the same `ICON_MAP` already exported by `components/domain/categories/category-avatar.tsx`, reused here — not duplicated) inside a `<g transform="translate(...)">`, fixed colour `className="text-white"` (contrast guaranteed on any slice colour, since the `SWATCH_CHART_COLOR` fills are all mid tones 400-500; no light/dark variation needed because the slice's own fill does not vary by theme).
   - `labelLine={false}` on the outer `<Pie>` to disable recharts' automatic connecting line (not needed, the icon is already inside the slice).
   - The inner layer (`fissa`/`variabile`) does **not** get this treatment — it stays without icons, unchanged.

No new pure calculation function needed (the 5% filter uses the `percent` provided by recharts directly, it does not require a separate testable function — it is a pure passthrough of a value already computed by the library). No impact on the legend, budget editing, or ordering already implemented.
