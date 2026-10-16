# Design: "Diviso" visual indicator in TransactionRow

**Date**: 2026-07-19
**Status**: approved in brainstorming, awaiting implementation plan

## Context

`components/domain/expenses/transaction-row.tsx` shows the row of each transaction in the Spese list. The "Dividi" (split) mechanism (`SplitSlider`, added in [2026-07-19-split-slider-shortcuts-design.md](2026-07-19-split-slider-shortcuts-design.md)) lets the user exclude part of the amount from the spending count (`excludedAmount`), but this value is not visible anywhere in the row itself: the amount shown is always `Math.abs(transaction.amount)` (the full amount), both for "Auto" transactions (`transaction-row.tsx:129-131`, read-only) and as the initial value of the editable field for "Manuale" transactions (`transaction-row.tsx:133-140`). The only place where the split can be seen is by opening the "Dividi" panel itself. User feedback: after splitting an expense, it is not clear that it was split, because the row stays unchanged.

## Design

### "Diviso" badge

New badge next to the existing Auto/Manuale one (`transaction-row.tsx:124-126`), `variant="ghost"`, text "Diviso" ("Split"). Visible when `Number(transaction.excludedAmount) > 0`. No change to the existing Auto/Manuale badge.

### "Auto" row (read-only)

Replaces `transaction-row.tsx:128-131`. When `excludedAmount > 0`:
- Main figure = net amount (`Math.abs(amount) - Math.abs(excludedAmount)`), same style as today (`text-sm font-medium tabular-nums`).
- Below, small and struck through, the original full amount: `formatCurrency(Math.abs(amount), currency)` with classes `text-xs text-muted-foreground line-through`.

When `excludedAmount === 0`, the rendering stays identical to today (only the full figure, no extra row).

### "Manuale" row (editable)

`CurrencyInput` (`transaction-row.tsx:133-140`) **stays unchanged**: it keeps editing `Math.abs(transaction.amount)`, the full amount — changing the shown/edited value to the net would break the editing semantics (the user must be able to correct the real bank amount, not a derived one). When `excludedAmount > 0`, a read-only informational line is added below the field: "Netto: {formatCurrency(net amount, currency)}" ("Net"), classes `text-xs text-muted-foreground`, right-aligned like the field above.

### What does NOT change

- No change to `SplitSlider`, to any API route, to the DB schema, or to the calculation engine (`lib/calc/expenses.ts`). The net calculation (`amount - excludedAmount`) is already used everywhere in the app; here we read the same data already present on `transaction`, no new fetch.
- No change to the logic of `commitAmount`/`commitDescription`/`commitDate`/`commitCategory`.
- The "Dividi" panel itself (`SplitSlider`) stays unchanged: it keeps showing "Spesa effettiva" / "Esclusa dal conteggio" inside it.

## Testing

No component test infrastructure in this project (see the earlier decision in [2026-07-19-split-slider-shortcuts-design.md](2026-07-19-split-slider-shortcuts-design.md)) — no automated tests planned for this change, which is purely conditional rendering. Manual verification in the browser required: Auto and Manuale transactions, both with and without a split, dark mode, checking that the badge/net amount/strikethrough appear only when `excludedAmount > 0` and disappear if the split is brought back to 0 from the Dividi panel.
