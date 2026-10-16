# Period navigation in Spese — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the period shown in the Spese ("Expenses") screen navigable (prev/next arrows + jump-to month/year menu), for all 4 period types (Settimana/Mese/3 mesi/Anno — week/month/3 months/year), without breaking the KPI calculation for past periods.

**Architecture:** `referenceDate` (which period is being viewed) and `today` (the real date, for the elapsed-days calculation) become two distinct parameters in the pure functions of `lib/calc/expenses.ts`. A new `ExpensesReferenceNav` component handles navigation (arrows) and direct jump (popover with a month/year grid), replacing the static subtitle in `app/(app)/spese/page.tsx`.

**Tech Stack:** Next.js App Router, TypeScript, vitest, shadcn/ui (style `base-nova`, `@base-ui/react`), Tailwind CSS v4.

## Global Constraints

- All visible strings in Italian.
- No hardcoded colors/radii: only Tailwind classes on theme tokens (`text-muted-foreground`, `bg-muted`, `text-foreground`, etc.).
- Every public function in `lib/calc/expenses.ts` has a minimal JSDoc (one line).
- shadcn components are added with `pnpm dlx shadcn@latest add <nome>` and are not modified by hand (except for token adaptation, not needed here).
- Spec reference: `docs/superpowers/specs/2026-07-22-spese-navigazione-periodo-design.md`.

---

### Task 1: `shiftReferenceDate` + export existing helpers

**Files:**
- Modify: `lib/calc/expenses.ts:21-23` (export `startOfDay`), `lib/calc/expenses.ts:238` (export `MONTH_LABELS`), add `shiftReferenceDate` after `getPreviousPeriodRange` (after line 85)
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Produces: `export function startOfDay(date: Date): Date`, `export const MONTH_LABELS: string[]`, `export function shiftReferenceDate(period: ExpensePeriod, referenceDate: Date, direction: 1 | -1): Date` — used by Tasks 2, 4, 5.

- [ ] **Step 1: Write the failing tests**

Add at the bottom of `lib/calc/expenses.test.ts` (after the `describe("compute6MonthTrend", ...)` block, before the end of the file) and update the import at the top of the file adding `shiftReferenceDate`:

```ts
// in the existing import at the top of the file, add shiftReferenceDate to the list:
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
  shiftReferenceDate,
} from "./expenses";
```

```ts
describe("shiftReferenceDate", () => {
  it("settimana sposta di 7 giorni avanti e indietro", () => {
    const referenceDate = new Date(2026, 6, 15);
    expect(shiftReferenceDate("settimana", referenceDate, 1)).toEqual(new Date(2026, 6, 22));
    expect(shiftReferenceDate("settimana", referenceDate, -1)).toEqual(new Date(2026, 6, 8));
  });

  it("mese sposta di un mese avanti e indietro, attraversando il cambio anno", () => {
    const referenceDate = new Date(2026, 0, 15); // January 2026
    expect(shiftReferenceDate("mese", referenceDate, 1)).toEqual(new Date(2026, 1, 15));
    expect(shiftReferenceDate("mese", referenceDate, -1)).toEqual(new Date(2025, 11, 15));
  });

  it("3mesi sposta di 3 mesi avanti e indietro", () => {
    const referenceDate = new Date(2026, 5, 15); // June 2026
    expect(shiftReferenceDate("3mesi", referenceDate, 1)).toEqual(new Date(2026, 8, 15));
    expect(shiftReferenceDate("3mesi", referenceDate, -1)).toEqual(new Date(2026, 2, 15));
  });

  it("anno sposta di un anno avanti e indietro", () => {
    const referenceDate = new Date(2026, 5, 15);
    expect(shiftReferenceDate("anno", referenceDate, 1)).toEqual(new Date(2027, 5, 15));
    expect(shiftReferenceDate("anno", referenceDate, -1)).toEqual(new Date(2025, 5, 15));
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `shiftReferenceDate` not exported from `./expenses`.

- [ ] **Step 3: Implement**

In `lib/calc/expenses.ts`, change (line 21):
```ts
function startOfDay(date: Date): Date {
```
to:
```ts
export function startOfDay(date: Date): Date {
```

Change (line 238):
```ts
const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
```
to:
```ts
export const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
```

Add right after the `getPreviousPeriodRange` function (after line 85, before `function isWithinRange`):
```ts
/** Shifts referenceDate by one period unit (forward if direction=1, backward if direction=-1). */
export function shiftReferenceDate(period: ExpensePeriod, referenceDate: Date, direction: 1 | -1): Date {
  switch (period) {
    case "settimana":
      return addDays(referenceDate, 7 * direction);
    case "mese":
      return addMonths(referenceDate, 1 * direction);
    case "3mesi":
      return addMonths(referenceDate, 3 * direction);
    case "anno":
      return new Date(referenceDate.getFullYear() + direction, referenceDate.getMonth(), referenceDate.getDate());
  }
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS, all tests including the new `shiftReferenceDate` block.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiunge shiftReferenceDate per navigare i periodi in Spese"
```

---

### Task 2: `formatPeriodLabel`

**Files:**
- Modify: `lib/calc/expenses.ts` (adds a function after `shiftReferenceDate`)
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: `DateRange`, `ExpensePeriod` (already existing in `lib/calc/expenses.ts`)
- Produces: `export function formatPeriodLabel(period: ExpensePeriod, range: DateRange): string` — used by Task 4 (`ExpensesReferenceNav`) and by `page.tsx`.

- [ ] **Step 1: Write the failing tests**

Add `formatPeriodLabel` to the import at the top of `lib/calc/expenses.test.ts` (the same import modified in Task 1), then add at the bottom of the file:

```ts
describe("formatPeriodLabel", () => {
  it("mese: nome mese esteso capitalizzato + anno", () => {
    const range = getPeriodRange("mese", new Date(2026, 6, 15));
    expect(formatPeriodLabel("mese", range)).toBe("Luglio 2026");
  });

  it("anno: solo l'anno", () => {
    const range = getPeriodRange("anno", new Date(2026, 6, 15));
    expect(formatPeriodLabel("anno", range)).toBe("2026");
  });

  it("settimana: giorno-giorno mese abbreviato, stesso anno, senza spazi attorno al trattino", () => {
    const range = getPeriodRange("settimana", new Date(2026, 6, 15));
    expect(formatPeriodLabel("settimana", range)).toBe("13–19 lug");
  });

  it("settimana: entrambe le date complete a cavallo d'anno", () => {
    const range = { from: new Date(2026, 11, 28), to: new Date(2027, 0, 3) };
    expect(formatPeriodLabel("settimana", range)).toBe("28 dic 2026 – 3 gen 2027");
  });

  it("3mesi: mese abbreviato - mese abbreviato + anno, stesso anno", () => {
    const range = getPeriodRange("3mesi", new Date(2026, 6, 15));
    expect(formatPeriodLabel("3mesi", range)).toBe("Mag – Lug 2026");
  });

  it("3mesi: entrambi i mesi con anno, a cavallo d'anno", () => {
    const range = getPeriodRange("3mesi", new Date(2026, 0, 15));
    expect(formatPeriodLabel("3mesi", range)).toBe("Nov 2025 – Gen 2026");
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `formatPeriodLabel` not exported from `./expenses`.

- [ ] **Step 3: Implement**

Add to `lib/calc/expenses.ts`, right after `shiftReferenceDate`:

```ts
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Readable label of the period shown in Spese, formatted according to the type (mese/settimana/3mesi/anno). */
export function formatPeriodLabel(period: ExpensePeriod, range: DateRange): string {
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  switch (period) {
    case "mese": {
      const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(range.from);
      return `${capitalize(monthName)} ${range.from.getFullYear()}`;
    }
    case "anno":
      return `${range.from.getFullYear()}`;
    case "settimana": {
      if (sameYear) {
        const day = new Intl.DateTimeFormat("it-IT", { day: "numeric" }).format(range.from);
        const dayMonth = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(range.to);
        return `${day}–${dayMonth}`;
      }
      const fullFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
      return `${fullFormat.format(range.from)} – ${fullFormat.format(range.to)}`;
    }
    case "3mesi": {
      const monthYearFormat = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });
      if (sameYear) {
        const monthOnly = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(range.from);
        return `${capitalize(monthOnly)} – ${capitalize(monthYearFormat.format(range.to))}`;
      }
      return `${capitalize(monthYearFormat.format(range.from))} – ${capitalize(monthYearFormat.format(range.to))}`;
    }
  }
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS, all tests including the new `formatPeriodLabel` block.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiunge formatPeriodLabel per l'etichetta periodo in Spese"
```

---

### Task 3: separate `referenceDate` (view) from `today` (real today) in `computeKpis`/`computeCategoryBreakdown`/`computeFixedVsVariable`

**Files:**
- Modify: `lib/calc/expenses.ts:148-173` (`computeKpis`), `lib/calc/expenses.ts:185-207` (`computeCategoryBreakdown`), `lib/calc/expenses.ts:215-229` (`computeFixedVsVariable`)
- Modify: `components/domain/expenses/expenses-kpi-cards.tsx` (adds the `today` prop)
- Modify: `app/(app)/spese/page.tsx` (adds `today`, updates the calls)
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: `startOfDay` (exported in Task 1)
- Produces: new signatures `computeKpis(transactions, budgets, period, referenceDate, today)`, `computeCategoryBreakdown(transactions, categories, period, referenceDate, today)`, `computeFixedVsVariable(transactions, categories, period, referenceDate, today)` — used by Tasks 4/5 (indirectly, via `page.tsx`) and by any future caller.

- [ ] **Step 1: Update the existing tests (the new signature makes them fail) and add the "past period" case**

In `lib/calc/expenses.test.ts`, replace the call in the `describe("computeKpis", ...)` block:

```ts
    const kpis = computeKpis(transactions, budgets, "mese", referenceDate);
```
with:
```ts
    const kpis = computeKpis(transactions, budgets, "mese", referenceDate, referenceDate);
```

Replace the call in the `describe("computeCategoryBreakdown", ...)` block:
```ts
    const breakdown = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15));
```
with:
```ts
    const breakdown = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
```

Replace the call in the `describe("computeFixedVsVariable", ...)` block:
```ts
    const result = computeFixedVsVariable(transactions, categories, "mese", new Date(2026, 1, 15));
```
with:
```ts
    const result = computeFixedVsVariable(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
```

Add a new test in the `describe("computeKpis", ...)` block, after the existing test:

```ts
  it("un periodo passato (mese concluso) conta tutti i giorni come trascorsi, indipendentemente da 'oggi'", () => {
    const referenceDate = new Date(2026, 1, 15); // view: mid-February 2026
    const today = new Date(2026, 3, 10); // real today: April 2026, February is already over
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "-100.00" }),
      makeTransaction({ date: "2026-02-28", amount: "-180.00" }), // end of month: future relative to referenceDate, past relative to today
    ];
    const budgets = [makeBudget({ monthlyAmount: "280.00" })];

    const kpis = computeKpis(transactions, budgets, "mese", referenceDate, today);

    expect(kpis.speso).toBe(280);
    expect(kpis.giorniRimasti).toBe(0);
    expect(kpis.mediaGiornaliera).toBeCloseTo(280 / 28, 5);
  });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL — too many arguments passed to functions with the old signature (TypeScript error) or, if TS does not block vitest right away, the new past-period test fails because `computeKpis` still interprets `referenceDate` as "today".

- [ ] **Step 3: Implement**

In `lib/calc/expenses.ts`, replace the whole `computeKpis` function (lines 148-173) with:

```ts
/**
 * Main Spese KPIs for the selected period. "Speso" and "Media giornaliera" count only the
 * days of the period already elapsed relative to `today` (the current real date); "Budget rimanente"/
 * "giorni rimasti" instead look at the whole calendar period (future days included).
 * `referenceDate` is the period being viewed (can be past or present, never future);
 * `today` is always the real date, independent of which period is being navigated.
 */
export function computeKpis(
  transactions: Transaction[],
  budgets: Budget[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): ExpensesKpis {
  const range = getPeriodRange(period, referenceDate);
  const todayStart = startOfDay(today);
  const clampedToday = todayStart.getTime() < range.from.getTime() ? range.from : todayStart;
  const elapsedRange: DateRange = {
    from: range.from,
    to: clampedToday.getTime() < range.to.getTime() ? clampedToday : range.to,
  };

  const { speseEffettive: speso } = computeSummary(transactions, elapsedRange);

  const budgetTotale = scaleBudgetForPeriod(totalMonthlyBudget(budgets), period);
  const budgetRimanente = budgetTotale - speso;
  const giorniRimasti = Math.max(0, daysBetween(todayStart, range.to));

  const elapsedDays = Math.max(1, daysBetween(range.from, elapsedRange.to) + 1);
  const mediaGiornaliera = speso / elapsedDays;

  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const { speseEffettive: prevSpeso } = computeSummary(transactions, previousRange);
  const previousDays = Math.max(1, daysBetween(previousRange.from, previousRange.to) + 1);
  const mediaGiornalieraPeriodoPrecedente = prevSpeso / previousDays;

  return { speso, budgetTotale, budgetRimanente, giorniRimasti, mediaGiornaliera, mediaGiornalieraPeriodoPrecedente };
}
```

Replace the whole `computeCategoryBreakdown` function (lines 185-207) with:

```ts
/** Actual expense per category in the selected period, one row for each of the user's categories. */
export function computeCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): CategoryAmount[] {
  const range = getPeriodRange(period, referenceDate);
  const todayStart = startOfDay(today);
  const clampedToday = todayStart.getTime() < range.from.getTime() ? range.from : todayStart;
  const elapsedRange: DateRange = {
    from: range.from,
    to: clampedToday.getTime() < range.to.getTime() ? clampedToday : range.to,
  };

  return categories.map((category) => {
    const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
    const { speseEffettive } = computeSummary(categoryTransactions, elapsedRange);
    return {
      categoryId: category.id,
      name: category.name,
      type: category.type,
      amount: speseEffettive,
      color: category.color,
      icon: category.icon,
    };
  });
}
```

Replace the whole `computeFixedVsVariable` function (lines 215-229) with:

```ts
/** Sum of the period's actual expense, grouped by category type (fixed/variable). */
export function computeFixedVsVariable(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): FixedVsVariable {
  const breakdown = computeCategoryBreakdown(transactions, categories, period, referenceDate, today);
  return breakdown.reduce(
    (totals, entry) => {
      totals[entry.type] += entry.amount;
      return totals;
    },
    { fissa: 0, variabile: 0 }
  );
}
```

Now update `components/domain/expenses/expenses-kpi-cards.tsx`: replace the whole file with:

```tsx
/** KPI row for the Spese screen: Spent in the period, Remaining budget, Daily average. */

import { StatCard } from "@/components/domain/stat-card";
import { computeKpis, type ExpensePeriod } from "@/lib/calc/expenses";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";

export interface ExpensesKpiCardsProps {
  transactions: Transaction[];
  budgets: Budget[];
  period: ExpensePeriod;
  currency: string;
  /** Period the user is viewing (can be past or present). */
  referenceDate: Date;
  /** Current real date, for the elapsed-days cut — independent of referenceDate. */
  today: Date;
}

export function ExpensesKpiCards({
  transactions,
  budgets,
  period,
  currency,
  referenceDate,
  today,
}: ExpensesKpiCardsProps) {
  const kpis = computeKpis(transactions, budgets, period, referenceDate, today);
  const trendLabel =
    kpis.mediaGiornaliera <= kpis.mediaGiornalieraPeriodoPrecedente
      ? "In calo rispetto al periodo precedente"
      : "In aumento rispetto al periodo precedente";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Speso nel periodo" value={-kpis.speso} currency={currency} />
      <StatCard
        label="Budget rimanente"
        value={kpis.budgetRimanente}
        currency={currency}
        subtitle={`${kpis.giorniRimasti} giorni rimasti`}
      />
      <StatCard
        label="Media giornaliera"
        value={-kpis.mediaGiornaliera}
        currency={currency}
        subtitle={trendLabel}
      />
    </div>
  );
}
```

(Note: `referenceDate` was optional with a `new Date()` default — now it is required, consistent with the required `today`: no silent default on a conceptually critical value.)

Finally, in `app/(app)/spese/page.tsx`:

Replace (line 43):
```tsx
  const referenceDate = React.useMemo(() => new Date(), []);
```
with:
```tsx
  const referenceDate = React.useMemo(() => new Date(), []);
  const today = React.useMemo(() => new Date(), []);
```

(converting `referenceDate` into navigable state happens in Task 4; here it stays constant, but `today` is introduced as a separate concept, already wired to the callers)

Replace (lines 131-136):
```tsx
          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(safeTransactions, safeCategories, period, referenceDate)}
            fixedVsVariable={computeFixedVsVariable(safeTransactions, safeCategories, period, referenceDate)}
            budgets={safeBudgets}
            currency={currency}
          />
```
with:
```tsx
          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(safeTransactions, safeCategories, period, referenceDate, today)}
            fixedVsVariable={computeFixedVsVariable(safeTransactions, safeCategories, period, referenceDate, today)}
            budgets={safeBudgets}
            currency={currency}
          />
```

Replace (lines 123-129):
```tsx
          <ExpensesKpiCards
            transactions={safeTransactions}
            budgets={safeBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
          />
```
with:
```tsx
          <ExpensesKpiCards
            transactions={safeTransactions}
            budgets={safeBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
            today={today}
          />
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS, all tests including the new "past period" test.

Also run: `pnpm exec tsc --noEmit`
Expected: no type errors (no caller left with the old signature).

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts components/domain/expenses/expenses-kpi-cards.tsx "app/(app)/spese/page.tsx"
git commit -m "fix: separa referenceDate (vista) da today (oggi reale) nei calcoli KPI di Spese"
```

---

### Task 4: `ExpensesReferenceNav` (prev/next arrows) and navigation in `page.tsx`

**Files:**
- Create: `components/domain/expenses/expenses-reference-nav.tsx`
- Test: `components/domain/expenses/expenses-reference-nav.tsx` has no dedicated tests (UI component, not pure logic) — verified via `pnpm exec tsc --noEmit` and build; the underlying pure logic (`shiftReferenceDate`, `formatPeriodLabel`) is already tested in Tasks 1-2
- Modify: `components/domain/expenses/index.ts` (barrel)
- Modify: `app/(app)/spese/page.tsx` (referenceDate becomes state, replaces the subtitle)

**Interfaces:**
- Consumes: `formatPeriodLabel`, `getPeriodRange`, `shiftReferenceDate`, `startOfDay` (Task 1/2), `ExpensePeriod`
- Produces: `ExpensesReferenceNav` with props `{ period: ExpensePeriod; referenceDate: Date; onChange: (newReferenceDate: Date) => void }` — extended by Task 5 with the popover, the signature does not change.

- [ ] **Step 1: Create the component**

Create `components/domain/expenses/expenses-reference-nav.tsx`:

```tsx
"use client";

/** Prev/next arrows to navigate the period shown in Spese, with the label of the active period. */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftReferenceDate,
  startOfDay,
  type ExpensePeriod,
} from "@/lib/calc/expenses";

export interface ExpensesReferenceNavProps {
  period: ExpensePeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}

export function ExpensesReferenceNav({ period, referenceDate, onChange }: ExpensesReferenceNavProps) {
  const range = getPeriodRange(period, referenceDate);
  const today = startOfDay(new Date());
  const isNextDisabled = range.to.getTime() >= today.getTime();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <span className="min-w-[9rem] text-center text-sm text-muted-foreground">
        {formatPeriodLabel(period, range)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, 1))}
        disabled={isNextDisabled}
        aria-label="Periodo successivo"
        className={cn(
          "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
          isNextDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
        )}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add to the barrel**

In `components/domain/expenses/index.ts`, add after the line `export type { ExpensesPeriodSelectorProps } from "./expenses-period-selector";`:

```ts
export { ExpensesReferenceNav } from "./expenses-reference-nav";
export type { ExpensesReferenceNavProps } from "./expenses-reference-nav";
```

- [ ] **Step 3: Compile check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (the component is not yet used by any page, but it must compile on its own).

- [ ] **Step 4: Wire in `page.tsx`**

In `app/(app)/spese/page.tsx`, add `ExpensesReferenceNav` to the existing import from `@/components/domain/expenses` (alphabetical order):

```tsx
import {
  AddTransactionForm,
  CategoryBreakdownDonut,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpensesReferenceNav,
  ExpenseTrendChart,
  TransactionRow,
} from "@/components/domain/expenses";
```

Replace (from Task 3):
```tsx
  const referenceDate = React.useMemo(() => new Date(), []);
  const today = React.useMemo(() => new Date(), []);
```
with:
```tsx
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const today = React.useMemo(() => new Date(), []);
```

Replace the title+subtitle block:
```tsx
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Spese</h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(range.from)} –{" "}
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(range.to)}
          </p>
        </div>
```
with:
```tsx
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Spese</h1>
          <ExpensesReferenceNav period={period} referenceDate={referenceDate} onChange={setReferenceDate} />
        </div>
```

- [ ] **Step 5: Compile and build check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm build`
Expected: build completed without errors.

- [ ] **Step 6: Commit**

```bash
git add components/domain/expenses/expenses-reference-nav.tsx components/domain/expenses/index.ts "app/(app)/spese/page.tsx"
git commit -m "feat: aggiunge navigazione prev/next del periodo in Spese"
```

---

### Task 5: jump-to month/year menu (popover)

**Files:**
- Create (via CLI): `components/ui/popover.tsx`
- Modify: `components/domain/expenses/expenses-reference-nav.tsx` (full replacement)

**Interfaces:**
- Consumes: `MONTH_LABELS` (Task 1), `Popover`/`PopoverTrigger`/`PopoverContent` primitives generated by the shadcn CLI
- Produces: no new public interface — `ExpensesReferenceNavProps` unchanged from Task 4.

- [ ] **Step 1: Add the popover primitive**

Run: `pnpm dlx shadcn@latest add popover`
Expected: creates `components/ui/popover.tsx`.

Then read the generated file (`components/ui/popover.tsx`) and confirm it exports `Popover`, `PopoverTrigger`, `PopoverContent` (same pattern as `Dialog`/`DialogTrigger`/`DialogContent` in `components/ui/dialog.tsx`: `PopoverContent` already includes `Portal`/`Positioner` internally, so it is used directly without extra wrappers). If the generated names differ, adapt the imports in Step 2 accordingly.

- [ ] **Step 2: Replace `expenses-reference-nav.tsx` with the version that includes the popover**

Replace the whole content of `components/domain/expenses/expenses-reference-nav.tsx` with:

```tsx
"use client";

/**
 * Navigation of the period shown in Spese: prev/next arrows + click on the label to open
 * a menu for jumping directly to a specific month/year (month grid, future years/months disabled).
 */

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftReferenceDate,
  startOfDay,
  MONTH_LABELS,
  type ExpensePeriod,
} from "@/lib/calc/expenses";

export interface ExpensesReferenceNavProps {
  period: ExpensePeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}

export function ExpensesReferenceNav({ period, referenceDate, onChange }: ExpensesReferenceNavProps) {
  const [open, setOpen] = React.useState(false);
  const [gridYear, setGridYear] = React.useState(referenceDate.getFullYear());
  const today = startOfDay(new Date());
  const range = getPeriodRange(period, referenceDate);
  const isNextDisabled = range.to.getTime() >= today.getTime();
  const isFutureGridYear = gridYear >= today.getFullYear();

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setGridYear(referenceDate.getFullYear());
    }
    setOpen(nextOpen);
  }

  function pickMonth(month: number) {
    onChange(new Date(gridYear, month, 1));
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </button>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          className="min-w-[9rem] rounded-md px-2 py-1 text-center text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {formatPeriodLabel(period, range)}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setGridYear((y) => y - 1)}
              aria-label="Anno precedente"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <span className="font-heading text-sm font-medium text-foreground">{gridYear}</span>
            <button
              type="button"
              onClick={() => setGridYear((y) => y + 1)}
              disabled={isFutureGridYear}
              aria-label="Anno successivo"
              className={cn(
                "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                isFutureGridYear && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
              )}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_LABELS.map((label, month) => {
              const isFutureMonth =
                gridYear > today.getFullYear() || (gridYear === today.getFullYear() && month > today.getMonth());
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pickMonth(month)}
                  disabled={isFutureMonth}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted",
                    isFutureMonth && "cursor-not-allowed opacity-40 hover:bg-transparent"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, 1))}
        disabled={isNextDisabled}
        aria-label="Periodo successivo"
        className={cn(
          "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
          isNextDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
        )}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Compile and build check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. If `PopoverTrigger`/`PopoverContent` do not accept `className`/`children` as written above, fix it based on the actual props generated by shadcn (checked in Step 1).

Run: `pnpm build`
Expected: build completed without errors.

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS (no pure function touched in this task).

- [ ] **Step 4: Commit**

```bash
git add components/ui/popover.tsx components/domain/expenses/expenses-reference-nav.tsx
git commit -m "feat: aggiunge menu jump-to mese/anno alla navigazione periodo in Spese"
```

---

## Manual verification (outside the scope of the automated tasks)

No Postgres/Redis available in this environment for a real browser (as for the earlier Spese features). After running the 5 tasks, the user must verify manually:
- Prev/next arrows change the period shown for all 4 types (Settimana/Mese/3 mesi/Anno).
- The "next" arrow is disabled when already in the current period.
- Clicking the label opens the popover; future months/years disabled; selecting a past month updates KPIs/charts/transaction list consistently.
- Correct KPIs on a past month (days left = 0, daily average computed over the whole month, not truncated at "today").
