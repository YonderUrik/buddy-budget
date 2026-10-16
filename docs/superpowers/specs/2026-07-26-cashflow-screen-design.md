# Cash flow — design

Date: 2026-07-26

## Purpose

New Cash flow screen (not implemented so far): comparison of income vs outflows, not just a view of spending. It first requires filling an existing gap — there is not yet a way to enter income (salary, freelance, dividends) in the product.

## 1. Data model

- `categoryTypeEnum` extended from `["fissa", "variabile"]` to `["fissa", "variabile", "entrata"]` (fixed, variable, income). No destructive migration, only a new enum value.
- `transactions`: schema unchanged. The sign of `amount` already encodes the direction (negative = outflow, positive = income) — no new column.
- `budgets`: unchanged. `entrata` categories will never appear in the Spese budget/donut/trend calculations because those calculations already filter on `isExpense` (`amount < 0`).
- No `isTransfer` column. Internal transfers between one's own accounts (giroconti) remain a known, deferred gap (see "Out of scope").

### API

- **GET `/api/transactions`**: today it filters hardcoded on `amount < 0` (outflows only). Extended with an optional `type` parameter (`uscita` default for backward compatibility / `entrata` / `tutte`).
- **POST `/api/transactions`**: today it always negates the entered amount (assumes an expense). The sign to save must be derived server-side from the `type` of the chosen category (`entrata` → positive amount as it is, `fissa`/`variabile` → negated amount), not from a separate field that the client could manipulate.

## 2. Spese page → Transazioni

- Rebrand: sidebar entry "Spese" → "Transazioni" (Expenses → Transactions), page title likewise. The route stays `/spese` (renaming the route brings no benefit, only risk).
- New list type toggle: **Tutte / Uscite / Entrate** (All / Outflows / Income), default **Uscite** (current behaviour unchanged by default). The toggle filters only the transaction list.
- KPI cards, category donut ("Fisse vs variabili" + budget), 6-month trend stay **always outflows-only**, independent of the toggle — they remain conceptually "spending analysis" and do not change content when the toggle is on Entrate. This avoids duplicating there the analysis work that belongs to Cash flow.
- `AddTransactionForm`: new **Spesa/Entrata** (Expense/Income) toggle. It determines which subset of categories can be selected (fissa+variabile vs entrata). The saved sign is derived server-side from the type of the chosen category (see above), not from this toggle directly — the toggle exists only to filter the category select on the client.
- Existing category filter (`ExpensesFilterBar`) unchanged, but the category select in "Aggiungi" (Add) excludes `entrata` unless the form toggle is on Entrata.
- `/categorie`: `add-category-form.tsx` and `category-row.tsx` gain the "Entrata" option in the type select (today only Fissa/Variabile).

## 3. Calculation engine — `lib/calc/cashflow.ts` (pure, tested)

- `isIncome(t)`: `amount > 0` — symmetrical to `isExpense` in `lib/calc/expenses.ts`.
- `CashflowPeriod = "3mesi" | "6mesi" | "12mesi" | "24mesi"`, with range/shift/nav built on the same pattern as Spese's `getPeriodRange`/`shiftReferenceDate` (period + back/forward navigation, not just "last N months from today").
- `computeCashflowKpis(transactions, range)`: average income/month, average outflows/month (full sum of outflows ÷ months in the range, no exclusion of transfers — known debt), net flow (income − outflows), savings rate (`netFlow / income`, null-safe if income = 0).
- `computeMonthlySeries(transactions, range)`: month-by-month array `{ mese, entrate, uscite }` for the side-by-side bar chart.
- `computeIncomeSources(transactions, categories, range)`: sum per `entrata`-type category in the range, sorted descending, with % share of total income — the same logical shape as `computeCategoryBreakdown` but for income.
- `computeWhereItGoes(transactions, categories, referenceDate)`: current month, 3 items — fixed expenses, variable expenses, savings (= income − fixed expenses − variable expenses of the month; it can be negative if you spend more than comes in, shown as it is, no floor at zero). Investments (PAC — piano di accumulo, recurring investment plan) omitted: the Investimenti screen does not exist yet in the project.
- `computeAccumulatedSavings(transactions, range)`: month-over-month cumulative sum of the net flow over the selected window, for the "Risparmio accumulato" (accumulated savings) chart + total.

All functions are pure and tested with vitest (same style as `expenses.test.ts`), including the combinations: income = 0, month without transactions, negative savings.

No new dedicated API route: the page fetches transactions (`type=tutte`) and categories through the existing TanStack Query hooks and computes everything client-side — the same pattern already used by Spese.

## 4. UI — `app/(app)/cashflow/page.tsx` (read-only)

New sidebar entry "Cash flow" → new route `/cashflow`. Layout from the top:

1. Header: title + `CashflowPeriodSelector` (3M/6M/12M/24M) + back/forward navigation (same pattern as `ExpensesReferenceNav`).
2. 4 KPI cards (`CashflowKpiCards`): Entrate medie, Uscite medie, Flusso netto, Tasso di risparmio (average income, average outflows, net flow, savings rate) — reusing the `ExpensesKpiCards` style.
3. "Entrate vs uscite" (income vs outflows) chart (`CashflowTrendChart`): recharts side-by-side bars, colours from the existing `--pos`/`--neg` tokens.
4. "Fonti di entrata" (income sources) (`IncomeSourcesList`): list of income categories with amount and % share, no donut (simple list, consistent with the functional spec).
5. "Dove va ogni euro" (where every euro goes) (`WhereItGoesBreakdown`): 3 items with amount and % (Fisse / Variabili / Risparmio), referring to the current month.
6. "Risparmio accumulato" (`AccumulatedSavingsChart`): line/area chart + total, over the same window as the selected period.

All new components live in `components/domain/cashflow/` with barrel `index.ts` (layer 2, consistent with the project's layered architecture). No inputs/buttons anywhere on the page — read-only, as per the functional spec.

## 5. Testing

- vitest on `lib/calc/cashflow.ts`: KPIs, monthly series, income sources, where-every-euro-goes, accumulated savings, including edge cases (income = 0, empty month, negative savings).
- `app/api/transactions/route.test.ts` extended: `GET` with the `type` parameter, `POST` with the sign derived from the category type.
- Category components (`add-category-form`, `category-row`) and the Transazioni form: existing tests extended for the new "Entrata" option/Spesa-Entrata toggle.

## Out of scope (explicitly deferred)

- **Internal transfers (giroconti)**: no exclusion from "Uscite medie", no `isTransfer` model. A known gap already present in the functional spec (Cash flow + Analitiche), to be tackled in a dedicated session when it is really needed.
- **Investments (PAC)** in "Dove va ogni euro": deferred until the Investimenti screen exists with real data.
- **i18n**: hardcoded Italian strings, consistent with the current state of the rest of the project.
