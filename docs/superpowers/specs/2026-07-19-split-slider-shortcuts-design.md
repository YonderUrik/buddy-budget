# Design: shortcuts and precise input for "Dividi" (SplitSlider)

**Date**: 2026-07-19
**Status**: approved in brainstorming, awaiting implementation plan

## Context

`components/domain/expenses/split-slider.tsx` (Spese screen, "Dividi" — split — mechanism) lets the user exclude part of a transaction's amount from the spending count (refunds, shared shares, transfers between own accounts), via a slider on `excludedAmount`. A mouse-drag imprecision bug has already been fixed in this session (library `@base-ui/react/slider`: the inner `Control` uses `range = values.length > 1`, different from the `range` of `Root`, so a single thumb on an array value sometimes receives a scalar number instead of an array in `onValueChange`).

User feedback after manual testing: the slider alone is not precise enough to set an exact value. Request: quick shortcuts for the most common use case (a bill split equally among n people) plus a numeric field for the exact value.

## Use case confirmed with the user

"Split by n" = a bill shared equally among n people including the user. The **user's share** (what must remain as actual spending) is `totalAmount / n`; the rest is excluded from the count:

```
excluded = totalAmount - totalAmount / n
```

Supported n: 2, 3, 4 (fixed buttons, no UI for arbitrary n).

## Design

### UI components added to `SplitSlider`

1. **Row of ÷2 ÷3 ÷4 buttons** (above the existing slider): `Button` variant `outline` size `sm` from `components/ui/button`. On click: compute `excluded` with the formula above, `setExcluded(value)` and **save immediately** (existing `commit()`, same `useUpdateTransactionMutation` mutation).
2. **"Spesa effettiva" (actual spending) numeric input**: `Input type="number"` from `components/ui/input`, step `0.01`, min `0`, max `totalAmount`. Shows `totalAmount - excluded` (not `excluded` directly: the user thinks in terms of "how much counts as spending", not of the excluded share). Updates only the local state on every keystroke (no mutation); saves on `onBlur` or `Enter` (`onKeyDown` on the `Enter` key), with the same `commit()`.
3. **Existing slider**: stays below, logic unchanged, synchronised with the same `excluded` state (buttons/input/slider are three ways of writing to the same `excluded`).
4. **Existing text summary row** ("Spesa effettiva: ... / Esclusa dal conteggio: ..." — "Actual spending / Excluded from the count") stays unchanged below the slider.

Final vertical order: explanatory text → ÷2÷3÷4 buttons → "Spesa effettiva" input → slider → text summary.

### Shared validation

New helper local to the file (no shared module needed, the only place it is used today):

```ts
function clampExcluded(rawExcluded: number, totalAmount: number): number {
  if (Number.isNaN(rawExcluded)) return 0;
  return Math.min(Math.max(rawExcluded, 0), totalAmount);
}
```

Used by: the ÷n buttons (for safety, even though the formula is already in range), the numeric input on blur/Enter (converts the typed "actual spending" value into `excluded = totalAmount - value`, then clamps), and it stays available for the slider should it be needed in the future. No rounding required beyond the 2 decimals already handled by `step=0.01`/`formatCurrency`.

### What does NOT change

- No change to the API, DB schema, or server-side `isValidExcludedAmount()`: the final value sent is always a numeric `excludedAmount` within the valid range already validated server-side.
- No change to the calculation engine `lib/calc/expenses.ts`.
- The ÷n buttons and the slider save immediately (the existing "commit on interaction end/click" behaviour); only the numeric input has a different policy (blur/Enter) so as not to generate a mutation for every character typed.

## Testing

No existing automated tests on this component (check during the plan whether there are any in `components/domain/expenses/*.test.*`). If so, add cases for: clicking ÷2/÷3/÷4 with various `totalAmount`s (including amounts with cents, e.g. €1.44), numeric input with an out-of-range value (negative, greater than the total) that must clamp, numeric input with a non-numeric value that must not break the state. Manual verification in the browser required for the UX (alignment of buttons/input/slider, dark mode, focus/tab order).
