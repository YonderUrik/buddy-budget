# Design: "Dividi/Escludi" for income

**Date**: 2026-07-28
**Context**: after the Cash flow screen was completed (`docs/superpowers/plans/2026-07-26-cashflow-screen.md`), the user noticed that some "entrata" (income) transactions (positive amount, e.g. synced via GoCardless) might not be real income — refunds, transfers between one's own accounts (giroconti), reversals — and wants to be able to exclude them (wholly or partly) from the count, with the same mechanism already used for outflows ("Dividi" — split).

## Problem

The Cash flow plan (Task 6) had explicitly hidden the "Dividi" button for income transactions in `TransactionRow` and in `AutoCategorizeWizard`, assuming that splitting made sense only for shared expenses. The user instead asks for the same, symmetrical mechanism for income: being able to exclude a share (up to the whole amount) of an income transaction from the count as real income.

## What already exists (reused, no changes)

- The `excludedAmount` column on `transactions` (schema, Zod validation) is already sign-agnostic.
- `isValidExcludedAmount` (`lib/db/schema/transactions.ts`) checks that `excludedAmount` has the same sign as `amount` and does not exceed it in absolute value — it works identically for positive or negative amounts, no change needed.
- `effectiveAmount(transaction)` (`lib/calc/expenses.ts`) = `amount - excludedAmount` — already sign-agnostic.
- `TransactionRow`: the "Diviso" (split) badge, the "Netto" (net) amount, and the display of the effective amount are already written with `Math.abs(...)` and do not assume a direction — they already work correctly for income, no changes required.
- `PATCH /api/transactions/[id]`: already accepts `excludedAmount` for any transaction, no direction-specific guard to remove.

## What changes

### 1. `components/domain/expenses/transaction-row.tsx`

Remove the `{!isIncome && (<Dividi button>)}` guard — the "Dividi" button becomes always visible, regardless of the transaction's direction. No other change to the component.

### 2. `components/domain/expenses/split-slider.tsx`

The component already receives the whole `transaction`, so it can derive the direction internally (`Number(transaction.amount) > 0`). Changes:
- Label of the numeric field: "Spesa effettiva" ("Actual spending", outflow) / "**Entrata effettiva**" ("Actual income", income) — same position, same behaviour (blur/Enter saves), only the text changes.
- Explanatory text above the slider: today fixed ("Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa (rimborsi, quote di altri, giroconto)." — "Move the slider to exclude a part from the count: it left the account, but it is not an expense (refunds, other people's shares, transfer)."); for income it becomes "Sposta il cursore per escludere una parte dal conteggio: è entrata sul conto, ma non è reddito reale (rimborsi, giroconto, storni)." ("Move the slider to exclude a part from the count: it came into the account, but it is not real income (refunds, transfer, reversals).").
- The ÷2/÷3/÷4 shortcuts and the numeric input stay unchanged in their logic (`computeSplitExcluded`, `clampExcluded` are already generic on the absolute value).

### 3. `components/domain/expenses/auto-categorize-wizard.tsx`

Same treatment as `transaction-row.tsx`: remove the `{!isIncome && (...)}` guard that hides the split slider inside the wizard. Dynamic labels identical to those of `SplitSlider` ("Entrata effettiva"/"Spesa effettiva" in the summary row under the slider). The line `onConfirm(categoryId, isIncome ? 0 : excluded)` must be changed to `onConfirm(categoryId, excluded)` — today it always zeroes `excludedAmount` for income; this must be removed, otherwise the exclusion set in the slider would never be saved.

### 4. `lib/calc/cashflow.ts`

Every sum of income will use `effectiveAmount(t)` instead of `Number(t.amount)` — the same pattern already used for outflows in this same file. Points to change:
- `computeCashflowKpis`: `entrate = inRange.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0)` (note: `effectiveAmount` for income stays positive, so the sum does not require `Math.abs`).
- `computeMonthlySeries`: the same change for each month's `entrate`.
- `computeIncomeSources`: both `totalEntrate` and the per-category accumulation (`amountByCategoryId`) will use `effectiveAmount(t)` instead of `Number(t.amount)`.
- `computeWhereItGoes`: the month's `entrate` total (used as the denominator for the % shares of fixed/variable/unclassified/savings) will use `effectiveAmount(t)`.

No direct change to `computeAccumulatedSavings`: it delegates to `computeMonthlySeries` and inherits the fix automatically.

`lib/calc/expenses.ts` requires no changes: income is already excluded from all its calculations (Spese/Transazioni stay outflows-only for the KPI/donut/trend widgets, as decided in the Cash flow plan).

## What does NOT change (out of scope, decided explicitly)

- No new "not real income" column/flag — the existing `excludedAmount` is reused, consistent with the user's instruction to treat it "like expenses".
- No change to the creation of an income transaction (`add-transaction-form.tsx`) — the split remains a post-creation action, as already for outflows.
- No change to `add-transaction-form.tsx`, `transactions-type-toggle.tsx`, API routes, DB schema.
- The "Dividi" button keeps the same text/label for both directions (only the inner content of `SplitSlider` changes) — no new separate "Escludi" ("Exclude") string, to stay faithful to "the same mechanism as expenses".

## Tests

Extend `lib/calc/cashflow.test.ts` with cases checking, for each of the 4 touched functions (`computeCashflowKpis`, `computeMonthlySeries`, `computeIncomeSources`, `computeWhereItGoes`), that an income transaction with `excludedAmount > 0` contributes only its net share (`effectiveAmount`), not the gross amount. No changes to the API tests (no change on the route/validation side).

No automated tests planned for the touched `.tsx` components (no component testing convention in this repo) — manual verification by the user planned, as for the other UI features of this project.
