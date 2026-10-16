# Categorizza automaticamente ("Categorize automatically") — similarity matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the exact description match in the "Categorizza automaticamente" suggestion engine with a token-based similarity match (Jaccard, numbers discarded), so that variable suffixes/codes and different branches of the same merchant are recognized as similar; show the similarity percentage in the wizard.

**Architecture:** `computeCategorizeSuggestions` compares each transaction to categorize against each historical transaction with a Jaccard index on the normalized tokens (numbers discarded), instead of the current exact map lookup. Aggregation by winning category unchanged (most frequent, tie → most recent); new field `averageSimilarity` in the output, shown in the wizard.

**Tech Stack:** Pure TypeScript (no new dependency), vitest.

## Global Constraints

- Similarity threshold: `SIMILARITY_THRESHOLD = 0.5`, inclusive (`≥`).
- Similarity = Jaccard index between sets of tokens (words), discarding purely numeric tokens (`^\d+$`).
- If one of the two token sets is empty (entirely numeric description), the comparison falls back to exact equality of the normalized string (no Jaccard on empty sets).
- No weighting by similarity score in choosing the winning category or in computing the split: a match above the threshold counts as one match, regardless of its score.
- `averageSimilarity` = average of the similarity scores of the winning category's matches only, rounded to 2 decimals.
- Scope limited to the manual wizard engine (`lib/calc/categorize-suggestions.ts`). Auto-categorization on GoCardless import (`lib/gocardless/categorize.ts`) stays exact-match, not touched by this plan.
- No change to the endpoint (`route.ts`) or hook (`lib/queries/transactions.ts`): the new field passes through the existing JSON serialization without schema changes.
- User strings in Italian (no i18n).

---

### Task 1: Similarity engine in `computeCategorizeSuggestions`

**Files:**
- Modify: `lib/calc/categorize-suggestions.ts`
- Modify: `lib/calc/categorize-suggestions.test.ts`

**Interfaces:**
- Consumes: type `Transaction` from `@/lib/db/schema/transactions` (unchanged).
- Produces:
  ```ts
  export interface CategorizeSuggestion {
    transaction: Transaction;
    suggestedCategoryId: string;
    matchCount: number;
    suggestedSplitPercentage: number | null;
    averageSimilarity: number; // NEW
  }
  export function computeCategorizeSuggestions(
    uncategorized: Transaction[],
    historical: Transaction[]
  ): CategorizeSuggestion[]
  ```
  Same signature as before (no change for the callers in Task 2 of the endpoint, already existing and not touched). Used by Task 2 of this plan (wizard UI, field `averageSimilarity`).

- [ ] **Step 1: Write the failing tests (new cases + the 6 existing ones remain)**

Replace the whole content of `lib/calc/categorize-suggestions.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { computeCategorizeSuggestions } from "./categorize-suggestions";
import type { Transaction } from "@/lib/db/schema/transactions";

let counter = 0;

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  counter += 1;
  return {
    id: overrides.id ?? `tx-${counter}`,
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Esselunga",
    amount: "-20.00",
    excludedAmount: "0.00",
    date: "2026-01-01",
    source: "manuale",
    externalId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("computeCategorizeSuggestions", () => {
  it("esclude le transazioni senza nessun match storico per descrizione", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Merchant sconosciuto" })];
    const historical = [makeTransaction({ id: "h1", description: "Esselunga", categoryId: "cat-food" })];

    expect(computeCategorizeSuggestions(uncategorized, historical)).toEqual([]);
  });

  it("suggerisce la categoria quando c'è un solo match, case-insensitive", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "ESSELUNGA" })];
    const historical = [
      makeTransaction({ id: "h1", description: "esselunga", categoryId: "cat-food", date: "2026-01-05" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedCategoryId).toBe("cat-food");
    expect(result[0].matchCount).toBe(1);
    expect(result[0].suggestedSplitPercentage).toBe(0);
    expect(result[0].averageSimilarity).toBe(1);
  });

  it("sceglie la categoria più frequente tra i match", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Netflix" })];
    const historical = [
      makeTransaction({ id: "h1", description: "Netflix", categoryId: "cat-svago", date: "2026-01-01" }),
      makeTransaction({ id: "h2", description: "Netflix", categoryId: "cat-abbonamenti", date: "2026-02-01" }),
      makeTransaction({ id: "h3", description: "Netflix", categoryId: "cat-abbonamenti", date: "2026-03-01" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].suggestedCategoryId).toBe("cat-abbonamenti");
    expect(result[0].matchCount).toBe(2);
  });

  it("in caso di pareggio sceglie la categoria della transazione più recente", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Amazon" })];
    const historical = [
      makeTransaction({ id: "h1", description: "Amazon", categoryId: "cat-a", date: "2026-01-01" }),
      makeTransaction({ id: "h2", description: "Amazon", categoryId: "cat-b", date: "2026-03-01" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].suggestedCategoryId).toBe("cat-b");
  });

  it("suggerisce la percentuale di split quando è coerente tra i match della categoria vincente", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Affitto condiviso", amount: "-60.00" })];
    const historical = [
      makeTransaction({
        id: "h1",
        description: "Affitto condiviso",
        categoryId: "cat-casa",
        amount: "-100.00",
        excludedAmount: "-50.00",
      }),
      makeTransaction({
        id: "h2",
        description: "Affitto condiviso",
        categoryId: "cat-casa",
        amount: "-40.00",
        excludedAmount: "-20.00",
      }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].suggestedSplitPercentage).toBe(0.5);
  });

  it("non suggerisce nessuna percentuale (null) quando lo split storico è incoerente", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Affitto condiviso" })];
    const historical = [
      makeTransaction({
        id: "h1",
        description: "Affitto condiviso",
        categoryId: "cat-casa",
        amount: "-100.00",
        excludedAmount: "-50.00",
      }),
      makeTransaction({
        id: "h2",
        description: "Affitto condiviso",
        categoryId: "cat-casa",
        amount: "-100.00",
        excludedAmount: "-30.00",
      }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].suggestedSplitPercentage).toBeNull();
  });

  it("riconosce come simile un suffisso/codice numerico variabile, scartandolo dal confronto", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "PAYPAL *NETFLIX 4471" })];
    const historical = [
      makeTransaction({ id: "h1", description: "PAYPAL *NETFLIX 8832", categoryId: "cat-svago" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedCategoryId).toBe("cat-svago");
    expect(result[0].averageSimilarity).toBe(1);
  });

  it("riconosce come simile una filiale diversa della stessa catena, esattamente alla soglia del 50%", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "ESSELUNGA VIA ROMA 12" })];
    const historical = [
      makeTransaction({ id: "h1", description: "ESSELUNGA VIA MILANO 45", categoryId: "cat-food" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedCategoryId).toBe("cat-food");
    expect(result[0].averageSimilarity).toBe(0.5);
  });

  it("esclude un match sotto la soglia del 50% (una sola parola in comune su cinque totali)", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Ristorante Rossi Milano" })];
    const historical = [
      makeTransaction({ id: "h1", description: "Ristorante Bianchi Torino", categoryId: "cat-food" }),
    ];

    expect(computeCategorizeSuggestions(uncategorized, historical)).toEqual([]);
  });

  it("descrizione interamente numerica: ricade sull'uguaglianza esatta invece che su insiemi di token vuoti", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "123456789" })];
    const historicalMatch = [
      makeTransaction({ id: "h1", description: "123456789", categoryId: "cat-varie" }),
    ];
    const historicalNoMatch = [
      makeTransaction({ id: "h2", description: "987654321", categoryId: "cat-varie" }),
    ];

    const matchResult = computeCategorizeSuggestions(uncategorized, historicalMatch);
    expect(matchResult).toHaveLength(1);
    expect(matchResult[0].averageSimilarity).toBe(1);

    expect(computeCategorizeSuggestions(uncategorized, historicalNoMatch)).toEqual([]);
  });

  it("calcola averageSimilarity come media dei soli match della categoria vincente", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Esselunga Via Torino 9" })];
    const historical = [
      makeTransaction({ id: "h1", description: "Esselunga Via Torino 9", categoryId: "cat-food" }),
      makeTransaction({ id: "h2", description: "Esselunga Via Napoli 3", categoryId: "cat-food" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].matchCount).toBe(2);
    expect(result[0].averageSimilarity).toBe(0.75);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test lib/calc/categorize-suggestions.test.ts`
Expected: FAIL — the new tests (suffix, branch, below threshold, numeric, average) fail because the current exact matching does not recognize different descriptions as similar, and `averageSimilarity` does not exist yet in the output.

- [ ] **Step 3: Write the implementation**

Replace the whole content of `lib/calc/categorize-suggestions.ts` with:

```ts
import type { Transaction } from "@/lib/db/schema/transactions";

export interface CategorizeSuggestion {
  transaction: Transaction;
  suggestedCategoryId: string;
  matchCount: number;
  suggestedSplitPercentage: number | null;
  averageSimilarity: number;
}

const SIMILARITY_THRESHOLD = 0.5;

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase();
}

/** Set of meaningful words of a description: normalized, split on spaces/punctuation, discarding purely numeric tokens (transaction codes, street numbers, references). */
function tokenize(description: string): Set<string> {
  const tokens = normalizeDescription(description)
    .split(/[^a-z0-9à-ÿ]+/)
    .filter((token) => token.length > 0 && !/^\d+$/.test(token));
  return new Set(tokens);
}

/** Jaccard index between two token sets: |intersection| / |union|. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize += 1;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Similarity between two descriptions: Jaccard on the normalized tokens (numbers discarded). If one of the two
 * has no meaningful tokens (entirely numeric description), it falls back to exact equality of the
 * normalized string instead of comparing empty sets.
 */
function descriptionSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return normalizeDescription(a) === normalizeDescription(b) ? 1 : 0;
  }
  return jaccardSimilarity(tokensA, tokensB);
}

/** Percentage of the amount excluded from the count ("Dividi"), rounded for consistency comparisons between different transactions. */
function splitPercentage(transaction: Transaction): number {
  const amount = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  if (amount === 0) return 0;
  return Math.round((excluded / amount) * 10000) / 10000;
}

/**
 * For each "Da categorizzare" transaction with at least one similar historical match (Jaccard on the
 * description tokens, numbers discarded, threshold 0.5), suggests the most frequent category among the matches
 * (tie → the most recent) and, if the historical split of the winning category is consistent, the
 * percentage to propose again, together with the average similarity of the winning matches.
 */
export function computeCategorizeSuggestions(
  uncategorized: Transaction[],
  historical: Transaction[]
): CategorizeSuggestion[] {
  const suggestions: CategorizeSuggestion[] = [];

  for (const transaction of uncategorized) {
    const matches: { transaction: Transaction; similarity: number }[] = [];
    for (const candidate of historical) {
      const similarity = descriptionSimilarity(transaction.description, candidate.description);
      if (similarity >= SIMILARITY_THRESHOLD) {
        matches.push({ transaction: candidate, similarity });
      }
    }
    if (matches.length === 0) continue;

    const countByCategory = new Map<string, number>();
    const mostRecentDateByCategory = new Map<string, string>();
    for (const match of matches) {
      const categoryId = match.transaction.categoryId;
      countByCategory.set(categoryId, (countByCategory.get(categoryId) ?? 0) + 1);
      const currentMostRecent = mostRecentDateByCategory.get(categoryId);
      if (!currentMostRecent || match.transaction.date > currentMostRecent) {
        mostRecentDateByCategory.set(categoryId, match.transaction.date);
      }
    }

    let winningCategoryId = "";
    let winningCount = -1;
    let winningMostRecentDate = "";
    for (const [categoryId, count] of countByCategory) {
      const mostRecentDate = mostRecentDateByCategory.get(categoryId) ?? "";
      const isBetter =
        count > winningCount || (count === winningCount && mostRecentDate > winningMostRecentDate);
      if (isBetter) {
        winningCategoryId = categoryId;
        winningCount = count;
        winningMostRecentDate = mostRecentDate;
      }
    }

    const winningMatches = matches.filter((match) => match.transaction.categoryId === winningCategoryId);
    const percentages = winningMatches.map((match) => splitPercentage(match.transaction));
    const allSame = percentages.every((percentage) => percentage === percentages[0]);
    const averageSimilarity =
      Math.round(
        (winningMatches.reduce((sum, match) => sum + match.similarity, 0) / winningMatches.length) * 100
      ) / 100;

    suggestions.push({
      transaction,
      suggestedCategoryId: winningCategoryId,
      matchCount: winningMatches.length,
      suggestedSplitPercentage: allSame ? percentages[0] : null,
      averageSimilarity,
    });
  }

  return suggestions;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm test lib/calc/categorize-suggestions.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/calc/categorize-suggestions.ts lib/calc/categorize-suggestions.test.ts
git commit -m "feat: match per similarità (Jaccard su token) nel motore di categorizzazione automatica"
```

---

### Task 2: Show the average similarity in the wizard

**Files:**
- Modify: `components/domain/expenses/auto-categorize-wizard.tsx`

**Interfaces:**
- Consumes: `CategorizeSuggestion.averageSimilarity` (Task 1, already present on every object passed as the `suggestion` prop to the `AutoCategorizeStep` component).
- Produces: no new interface — only a change in the displayed text.

- [ ] **Step 1: Update the step's subtitle line**

In `components/domain/expenses/auto-categorize-wizard.tsx`, find:

```tsx
        <DialogDescription>
          Basato su {suggestion.matchCount} transazioni passate categorizzate così.
        </DialogDescription>
```

Replace it with:

```tsx
        <DialogDescription>
          Basato su {suggestion.matchCount} transazioni simili (
          {Math.round(suggestion.averageSimilarity * 100)}% di somiglianza media).
        </DialogDescription>
```

- [ ] **Step 2: Verify type-check, lint and build**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no new errors (the project already has 2 known pre-existing warnings on `react-hooks/set-state-in-effect`, not touched by this task).

Run: `pnpm build`
Expected: build completed without errors.

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/auto-categorize-wizard.tsx
git commit -m "feat: mostra la somiglianza media nel wizard Categorizza automaticamente"
```

---

## Manual user verification (outside agent scope)

No Postgres/Redis available in the agentic sandbox for a real browser (same constraint as the previous Spese/Categorie features). To verify manually at the end of the implementation:
- With historical transactions with the same exact description, the wizard still shows "100% di somiglianza media" and behaves as before.
- With a transaction to categorize that is similar (not identical) to a historical one — e.g. same merchant with a different code/branch — the button finds it and the wizard shows a percentage below 100%.
- With completely different transactions, the button keeps showing "Nessuna transazione simile trovata da suggerire."
