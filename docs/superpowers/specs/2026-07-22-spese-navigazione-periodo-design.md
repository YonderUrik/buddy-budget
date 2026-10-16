# Period navigation in Spese

Date: 2026-07-22

## Context

The Spese (Expenses) screen (`app/(app)/spese/page.tsx`) has a Settimana/Mese/3 mesi/Anno (Week/Month/3 months/Year) selector (`ExpensesPeriodSelector`), but `referenceDate` is always a fixed `new Date()` — there is no way to see past or future months/periods (within the "not beyond today" limit). The user wants to be able to change month (e.g. go from July to June) and, more generally, to do so for any selected period type.

## Architectural problem to solve

Today `referenceDate` serves two different purposes inside `computeKpis` and `computeCategoryBreakdown` (`lib/calc/expenses.ts`):

1. **Which period to show** — input of `getPeriodRange(period, referenceDate)`.
2. **"Today", for the elapsed-days cut-off** — inside `computeKpis`, `elapsedRange.to = min(range.to, referenceDate-as-today)`.

If `referenceDate` becomes navigable and stays the only parameter, a past month would compute "elapsed days"/"daily average" as if that month were still in progress up to the current day of the month, instead of treating it as fully concluded. Wrong data in a finance app.

**Fix**: separate the two roles into two distinct parameters passed to the calculation functions:
- `referenceDate` — the period the user is looking at (navigates back/forward)
- `today` — the real `new Date()`, always, used only for the elapsed-days cut-off

The functions `computeKpis` and `computeCategoryBreakdown` in `lib/calc/expenses.ts` change signature to accept `today` as a separate explicit parameter (no longer deduced from `referenceDate`). `compute6MonthTrend` keeps a single parameter: the 6-month trend follows the current view (if you navigate to March, it shows the last 6 months up to March), there is no need to distinguish it from "today".

## New pure functions (`lib/calc/expenses.ts`)

### `shiftReferenceDate(period: ExpensePeriod, referenceDate: Date, direction: 1 | -1): Date`

Shifts `referenceDate` by one period unit:
- `settimana`: ±7 days
- `mese`: ±1 month
- `3mesi`: ±3 months
- `anno`: ±1 year

Reuses the existing internal helpers (`addDays`, `addMonths`) with the same pattern as `getPreviousPeriodRange`.

### Blocking future navigation

No new dedicated function: the component computes `getPeriodRange(period, referenceDate).to >= startOfDay(real today)` to disable the "next" button (current period or beyond = you cannot go further). `startOfDay` must be exported from `lib/calc/expenses.ts` (today it is local to the module) or replicated in the component — it is exported to avoid duplication.

### Period label

New function `formatPeriodLabel(period: ExpensePeriod, range: DateRange): string`, Italian formatting:
- `mese`: `"Luglio 2026"` (full month name + year)
- `settimana`: `"21–27 lug"` (same year) or `"28 dic – 3 gen"` (across years, shows both years if different: `"28 dic 2026 – 3 gen 2027"`)
- `3mesi`: `"Mag – Lug 2026"` (abbreviated start month – abbreviated end month + end year; if across years shows both years)
- `anno`: `"2026"`

Uses `Intl.DateTimeFormat("it-IT", ...)` for the month names, consistent with the rest of the code (`app/(app)/spese/page.tsx` already uses `Intl.DateTimeFormat("it-IT", ...)`).

This label replaces the current date-range subtitle under the "Spese" title in `page.tsx` (lines 76-79) — two textual representations of the same range do not coexist.

## New component: `ExpensesReferenceNav`

`components/domain/expenses/expenses-reference-nav.tsx`. Props:

```ts
export interface ExpensesReferenceNavProps {
  period: ExpensePeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}
```

Renders: `‹ [clickable label] ›`. The arrows call `onChange(shiftReferenceDate(period, referenceDate, ±1))`. The "next" arrow is disabled according to the future-blocking rule above.

Clicking the label opens a popover (new shadcn primitive `components/ui/popover.tsx`, to be added with `pnpm dlx shadcn@latest add popover`) with:
- `‹ 2026 ›` arrows to change the year (future year disabled)
- a 3×4 grid of the 12 abbreviated months (the same labels as `MONTH_LABELS`, which must be exported from `lib/calc/expenses.ts`), future months (relative to the real today) disabled

Selecting a month calls `onChange(new Date(year, month, 1))` — the active period (Week/Month/3 months/Year) is recomputed on that new date through `getPeriodRange`, unchanged.

The component lives in `components/domain/expenses/index.ts` (barrel) next to the others.

## Changes to `page.tsx`

- `referenceDate` goes from a constant `useMemo` to `useState<Date>(() => new Date())`.
- Added `const today = React.useMemo(() => new Date(), [])` for the "real today" parameter passed to `computeKpis`/`computeCategoryBreakdown` (via `ExpensesKpiCards` and the inline category breakdown calculation).
- The subtitle under "Spese" is replaced by `formatPeriodLabel(period, range)` inside `ExpensesReferenceNav`, which sits in the header next to `ExpensesPeriodSelector`.
- `fetchWindow(referenceDate)` keeps the same signature — it moves automatically following the navigated `referenceDate`, no change needed.

## Changes to `ExpensesKpiCards`

Adds the prop `today: Date` (new, required, not optional — it forces the caller to pass it explicitly instead of a silent default that could hide the conceptual error fixed in this design). `computeKpis(transactions, budgets, period, referenceDate, today)`.

## What does NOT change

- `ExpensesPeriodSelector` (Settimana/Mese/3 mesi/Anno pills): unchanged.
- `CategoryBreakdownDonut`, `ExpenseTrendChart`, `TransactionRow`, `AddTransactionForm`: unchanged (they already receive computed data and know `referenceDate` only through the already navigated calculation functions).
- No change to the data model/API — everything is client-side, the fetch window already covers the needed range by following `referenceDate`.

## Testing

- `lib/calc/expenses.test.ts`: new tests for `shiftReferenceDate` (all 4 period types, including year change for `mese`/`anno` across the boundary) and `formatPeriodLabel` (all 4 types, including the across-years case for `settimana`/`3mesi`).
- `computeKpis`/`computeCategoryBreakdown`: update the existing tests to the new signature with explicit `today`; add a case with `referenceDate` in the past (concluded month) that checks `giorniRimasti = 0` and `mediaGiornaliera` computed over the whole month, not truncated to "today".
- No automated browser tests available in this environment (no Postgres/Redis) — manual verification by the user required after implementation, as for the previous Spese features.
