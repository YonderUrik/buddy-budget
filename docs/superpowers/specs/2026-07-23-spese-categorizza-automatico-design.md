# Categorizza automaticamente — Spese

## Problem

"Da categorizzare" ("To categorise") transactions often repeat descriptions that were already categorised by hand in the past (same merchant/payment reason). Today they must be categorised one by one by hand, even when the correct choice is obvious because it was already made before. If in the past the expense was also "split" (refund/other people's share), that split should be proposed again with the same percentage.

## Goal

A global action in Spese (Expenses), "Categorizza automaticamente" ("Categorise automatically"), that:
1. Finds the "Da categorizzare" transactions whose description matches (exact, case-insensitive) descriptions already categorised in the past.
2. Suggests the category most used historically for that description (and, if present, the consistent split percentage).
3. Always asks the user for confirmation, transaction by transaction, with the option to change category and split before confirming.

Out of scope: fuzzy/per-token matching (only exact equality of `description`, the same logic already used in `lib/gocardless/categorize.ts`); bulk application without confirmation.

## Pure calculation engine

New module `lib/calc/categorize-suggestions.ts`.

```ts
export interface CategorizeSuggestion {
  transaction: Transaction;
  suggestedCategoryId: string;
  matchCount: number; // how many historical transactions contributed to the match
  suggestedSplitPercentage: number | null; // 0..1, null = no consistent split to propose
}

export function computeCategorizeSuggestions(
  uncategorized: Transaction[],
  historical: Transaction[] // non-fallback category, same user
): CategorizeSuggestion[]
```

Algorithm:
- Group `historical` by `description.toLowerCase().trim()`.
- For each transaction in `uncategorized`, look for the group with the same key.
  - No group → excluded from the result (no suggestion).
  - Group found → winning category = the one with the most occurrences in the group; in case of a tie, the one of the most recent transaction (`date` desc) among the tied candidates wins.
- Split percentage: among only the group's transactions that have the winning category, compute `excludedAmount / amount` for each (absolute value). If they all coincide (comparison rounded to 4 decimals for floating-point tolerance), that is `suggestedSplitPercentage`. Otherwise `null`. A single match with the winning category counts as "consistent" (its own percentage).
- `matchCount` = number of transactions in the group with the winning category.

Tested with vitest: single group, majority category, tie resolved by most recent date, consistent split, inconsistent split (→ null), no match.

## API

`GET /api/transactions/categorize-suggestions`
- Standard auth (401 if not authenticated).
- Query: all of the user's transactions with an `isFallback = true` category (candidates) and all those with a non-fallback category (history) — **no period filter**, the user's whole history.
- Calls `computeCategorizeSuggestions`, returns the array of suggestions (JSON, including the full transaction for rendering in the wizard).

No new write endpoint. Applying a suggestion reuses the existing `PATCH /api/transactions/[id]` (it already supports `categoryId` and `excludedAmount` on "auto" transactions too, with ownership validation and the split invariant).

## Client data layer

`lib/queries/transactions.ts`: new hook `useCategorizeSuggestionsQuery()`, a `useQuery` with `enabled: false` — it does not start on mount, only on an explicit `refetch()` when the wizard is opened.

## UI

**Button** "Categorizza automaticamente" in `ExpensesFilterBar` (or a row above the transaction list). Always visible and clickable.

On click:
- `refetch()` of the suggestions (loading state on the button).
- 0 results → inline message "Nessuna transazione simile trovata da suggerire" ("No similar transaction found to suggest"), no dialog.
- ≥1 result → opens `AutoCategorizeWizard`.

**New component** `components/domain/expenses/auto-categorize-wizard.tsx`, a dialog (`components/ui/dialog.tsx`) with local `currentIndex` state over the array of suggestions received as a prop:

- Header: "Rivedi categorizzazione (X di N)" ("Review categorisation (X of N)").
- Body, for the current suggestion:
  - Description, date, amount of the transaction to categorise.
  - Note "Basato su {matchCount} transazioni passate categorizzate così" ("Based on {matchCount} past transactions categorised this way").
  - Category `Select` pre-filled with `suggestedCategoryId` (the same pattern with `CategoryAvatar` as `TransactionRow`/`ExpensesFilterBar`), freely changeable before confirming.
  - Local split editor (React state, not the existing `SplitSlider` component — that one commits immediately on every interaction on a transaction already on screen; here buffered state is needed until Conferma is pressed): reuses the pure functions `clampExcluded`/`computeSplitExcluded` from `split-slider.utils.ts`. Pre-filled with `suggestedSplitPercentage` (0 if null).
- Footer: **Salta** (Skip) button (advances `currentIndex` with no side effect) and **Conferma** (Confirm) button (calls `useUpdateTransactionMutation` with `{ categoryId, excludedAmount }` from the current local state, then advances `currentIndex` on success).
- `currentIndex === suggestions.length` → summary screen ("Applicate X di Y transazioni" — "Applied X of Y transactions") with a Chiudi (Close) button.
- Early closing (✕ or overlay click): confirmations already performed stay applied (each confirmation was already a successful PATCH, there is no atomic group transaction to roll back).

## Error handling

- PATCH failure in a step: show an inline error (the same `updateMutation.isError` pattern already in use), do not advance automatically — the user can retry Conferma or Skip anyway.
- Scan query failure: error message on the button, no dialog opened.

## Testing

- vitest unit tests on `computeCategorizeSuggestions` (cases listed above).
- Route test for `GET /api/transactions/categorize-suggestions` (existing pattern in `app/api/transactions/route.test.ts`): auth required, excludes transactions without a match, chooses the majority category, ownership (must not consider other users' transactions).
- No new browser e2e tests (the same sandbox constraint already known for the other Spese/Categorie features: manual verification by the user required at the end of implementation).
