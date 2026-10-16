# Categorizza automaticamente — similarity match (addendum)

> Extends `docs/superpowers/specs/2026-07-23-spese-categorizza-automatico-design.md` and the plan `docs/superpowers/plans/2026-07-23-spese-categorizza-automatico.md` (Tasks 1-4 already implemented and merged with exact matching). This document replaces the calculation engine's matching criterion with token similarity, keeping endpoint, hook and wizard structure unchanged.

## Context

The "Categorizza automaticamente" ("Categorise automatically") wizard in Spese (Tasks 1-4, already in `main`) suggests category and split for "Da categorizzare" ("To categorise") transactions based on an **exact** match (case-insensitive, trim) on the description. In real use this excludes pairs of transactions clearly from the same merchant but with slightly different descriptions:

- **Variable suffixes/codes**: `"PAYPAL *NETFLIX 4471"` vs `"PAYPAL *NETFLIX 8832"`.
- **Different branches/locations of the same chain**: `"ESSELUNGA VIA ROMA 12"` vs `"ESSELUNGA VIA MILANO 45"`.

**Explicitly out of scope** (decided in brainstorming): automatic categorisation at GoCardless import time (`lib/gocardless/categorize.ts`) stays unchanged, exact match — this change concerns only the engine of the manual wizard (`lib/calc/categorize-suggestions.ts`). Typos/misspellings are not a requested use case (they do not drive the choice of algorithm).

## Similarity algorithm

**Tokenisation** (`tokenize(description)`):
1. Lowercase, trim (the same existing `normalizeDescription` as a base).
2. Split on spaces and punctuation (whitespace + non-alphanumeric characters as separators).
3. Discard purely numeric tokens (regex `^\d+$`) — they cover transaction codes, street numbers, references.
4. Result: a `Set<string>` of "meaningful" words.

**Degenerate case**: if the resulting set is empty (a description made only of numbers, e.g. a transfer reference like `"RIF 00123456"` → after discarding the numbers `{"rif"}` remains, not empty; but a case like a pure `"123456789"` produces an empty set), the comparison for that transaction falls back to exact equality of the original normalised string (behaviour identical to today) — no Jaccard on empty sets.

**Similarity** (`similarity(a, b)`): Jaccard index between the two token sets — `|intersection| / |union|`. Range `[0, 1]`. Two descriptions identical after tokenisation → `1`.

**Threshold**: `SIMILARITY_THRESHOLD = 0.5` (named constant in the module). A pair (transaction to categorise, historical transaction) is a match if `similarity ≥ 0.5`.

Verified example: `"ESSELUNGA VIA ROMA 12"` → `{esselunga, via, roma}`, `"ESSELUNGA VIA MILANO 45"` → `{esselunga, via, milano}` → intersection 2, union 4 → `0.5` → included (inclusive threshold, `≥`).

## Changes to the calculation engine

File: `lib/calc/categorize-suggestions.ts` (existing, to be modified).

**Before** (today): grouping of historical transactions into a `Map<normalizedDescription, Transaction[]>`, then an exact lookup for each transaction to categorise.

**After**: for each transaction to categorise, comparison against **every** historical transaction (no pre-grouping by exact key, similarity is not a transitive equivalence relation). The historical transactions with `similarity ≥ 0.5` relative to the current transaction form the match group.

The rest of the pipeline stays **unchanged**:
- Winning category = the most frequent among the matches; tie → the category of the most recent matching transaction (`date` desc).
- `matchCount` = number of matches of the winning category (no longer "exact matches", now "similar matches above the threshold").
- `suggestedSplitPercentage` = computed only on the matches of the winning category, same consistency logic (all equal rounded to 4 decimals → that value, otherwise `null`).
- **No weighting by similarity score** in choosing the winning category or computing the split: a match above the threshold counts as one match, regardless of its exact score (0.5 and 1.0 weigh the same). A deliberate choice to stay simple — not requested; avoid introducing an unspecified weighted voting criterion.

**New output field**:

```ts
export interface CategorizeSuggestion {
  transaction: Transaction;
  suggestedCategoryId: string;
  matchCount: number;
  suggestedSplitPercentage: number | null;
  averageSimilarity: number; // NEW: average of the similarity scores of only the winning category's matches, rounded to 2 decimals
}
```

`averageSimilarity` for a traditional exact match (same description) is always `1`.

## Endpoint and hook

`app/api/transactions/categorize-suggestions/route.ts` and `lib/queries/transactions.ts`: **no changes**. They already pass `uncategorized`/`historical` as they are; the new `averageSimilarity` field goes through the existing JSON serialisation without needing to change the response schema (no Zod validation on the output).

## UI — wizard

File: `components/domain/expenses/auto-categorize-wizard.tsx` (existing, to be modified).

The line under the title of each step changes from:
```
Basato su {suggestion.matchCount} transazioni passate categorizzate così.
```
to:
```
Basato su {suggestion.matchCount} transazioni simili ({Math.round(suggestion.averageSimilarity * 100)}% di somiglianza media).
```
("Based on {n} similar transactions ({x}% average similarity)".)

Always shown, even when the average similarity is 100% (traditional exact match) — no special condition, a single string format for both cases. No other UI element changes (category/split stay editable as today, "Salta"/"Conferma" (Skip/Confirm)/early closing unchanged).

## Tests

`lib/calc/categorize-suggestions.test.ts` (existing, to be extended): the 6 current tests stay valid (their matches are identical descriptions → similarity 1.0, above the threshold, unchanged behaviour). New cases:

- Variable numeric suffix: `"PAYPAL *NETFLIX 4471"` to categorise, history `"PAYPAL *NETFLIX 8832"` → match found, `averageSimilarity` = 1 (numbers are discarded on both sides, the token sets stay identical).
- Different branch at exactly 50%: the Esselunga example above → match found (inclusive threshold), `averageSimilarity` = 0.5.
- Below threshold: two descriptions with only 1 word in common out of 4 in total (0.25) → no match, transaction excluded from the result (behaviour identical to today's "no historical match" case).
- Fully numeric description: transaction to categorise with description `"123456789"`, history with the same exact string → match via the equality fallback; history with a different numeric string → no match.
- `averageSimilarity` computed correctly when the winning category has several matches with different scores (e.g. two matches, one at 1.0 and one at 0.5 → average 0.75).

## Out of scope (unchanged from the original design)

- No period filter in the scan: the user's whole history.
- No new write endpoint: applying reuses `PATCH /api/transactions/[id]`.
- Sequential wizard, category and split always editable, "Salta" applies nothing, early closing leaves already made confirmations applied.
- User strings in Italian, no i18n.
- GoCardless automatic categorisation at import (`lib/gocardless/categorize.ts`) stays exact-match — not touched by this document.
