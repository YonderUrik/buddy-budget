# Categorizza automaticamente ("Categorize automatically") in Spese (Expenses) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Categorizza automaticamente" button in Spese that suggests a category (and split) for "Da categorizzare" ("To categorize") transactions based on identical descriptions categorized in the past, with explicit transaction-by-transaction confirmation in a sequential wizard.

**Architecture:** Pure calculation engine (`computeCategorizeSuggestions`) → new endpoint `GET /api/transactions/categorize-suggestions` that invokes it on the user's data → lazy TanStack Query hook (`enabled: false`) → `AutoCategorizeButton` component (trigger + zero-results state) that opens `AutoCategorizeWizard` (sequential dialog), which reuses the already existing transaction PATCH to apply each confirmation.

**Tech Stack:** Next.js Route Handlers, Drizzle ORM, TanStack Query, Zod (no new schema: reuses `updateTransactionSchema`), vitest, `@base-ui/react` components via `components/ui/*` (Dialog, Select, Slider, Button).

## Global Constraints

- Match only on exact `description` (case-insensitive, trim), no fuzzy/token matching.
- No period filter in the scan: consider the user's whole history.
- No new write endpoint: applying the suggestions reuses `PATCH /api/transactions/[id]`.
- Suggested category = most frequent among the historical matches; tie → the one with the most recent transaction (`date` desc) among the candidates with equal count.
- Suggested split percentage computed only on the matches of the winning category; consistent (all equal, rounded to 4 decimals) → that percentage, otherwise `null` (no proposal, editable, 0 by default).
- Sequential wizard (one transaction at a time), category and split always editable before confirming; "Salta" ("Skip") applies nothing; closing early leaves the confirmations already made applied.
- User strings in Italian (no i18n).
- All visible strings come from this spec, no hardcoded color/radius values (reuse the existing theme tokens).

---

### Task 1: Pure calculation engine `computeCategorizeSuggestions`

**Files:**
- Create: `lib/calc/categorize-suggestions.ts`
- Test: `lib/calc/categorize-suggestions.test.ts`

**Interfaces:**
- Consumes: type `Transaction` from `@/lib/db/schema/transactions` (fields used: `id`, `categoryId`, `description`, `amount`, `excludedAmount`, `date`).
- Produces:
  ```ts
  export interface CategorizeSuggestion {
    transaction: Transaction;
    suggestedCategoryId: string;
    matchCount: number;
    suggestedSplitPercentage: number | null;
  }
  export function computeCategorizeSuggestions(
    uncategorized: Transaction[],
    historical: Transaction[]
  ): CategorizeSuggestion[]
  ```
  Used by Task 2 (route handler).

- [ ] **Step 1: Write the failing test**

Create `lib/calc/categorize-suggestions.test.ts`:

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
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test lib/calc/categorize-suggestions.test.ts`
Expected: FAIL — `Cannot find module './categorize-suggestions'` (the file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/calc/categorize-suggestions.ts`:

```ts
import type { Transaction } from "@/lib/db/schema/transactions";

export interface CategorizeSuggestion {
  transaction: Transaction;
  suggestedCategoryId: string;
  matchCount: number;
  suggestedSplitPercentage: number | null;
}

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase();
}

/** Percentage of the amount excluded from the count ("Dividi"), rounded for consistency comparisons between different transactions. */
function splitPercentage(transaction: Transaction): number {
  const amount = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  if (amount === 0) return 0;
  return Math.round((excluded / amount) * 10000) / 10000;
}

/**
 * For each "Da categorizzare" transaction with at least one historical match (same description, exact
 * case-insensitive), suggests the most frequent category among the matches (tie → the most recent) and,
 * if the historical split of the winning category is consistent, the percentage to propose again.
 */
export function computeCategorizeSuggestions(
  uncategorized: Transaction[],
  historical: Transaction[]
): CategorizeSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of historical) {
    const key = normalizeDescription(transaction.description);
    const group = groups.get(key);
    if (group) {
      group.push(transaction);
    } else {
      groups.set(key, [transaction]);
    }
  }

  const suggestions: CategorizeSuggestion[] = [];

  for (const transaction of uncategorized) {
    const group = groups.get(normalizeDescription(transaction.description));
    if (!group || group.length === 0) continue;

    const countByCategory = new Map<string, number>();
    const mostRecentDateByCategory = new Map<string, string>();
    for (const match of group) {
      countByCategory.set(match.categoryId, (countByCategory.get(match.categoryId) ?? 0) + 1);
      const currentMostRecent = mostRecentDateByCategory.get(match.categoryId);
      if (!currentMostRecent || match.date > currentMostRecent) {
        mostRecentDateByCategory.set(match.categoryId, match.date);
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

    const winningMatches = group.filter((match) => match.categoryId === winningCategoryId);
    const percentages = winningMatches.map(splitPercentage);
    const allSame = percentages.every((percentage) => percentage === percentages[0]);

    suggestions.push({
      transaction,
      suggestedCategoryId: winningCategoryId,
      matchCount: winningMatches.length,
      suggestedSplitPercentage: allSame ? percentages[0] : null,
    });
  }

  return suggestions;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm test lib/calc/categorize-suggestions.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/calc/categorize-suggestions.ts lib/calc/categorize-suggestions.test.ts
git commit -m "feat: aggiungi motore di calcolo per suggerimenti di categorizzazione automatica"
```

---

### Task 2: Endpoint `GET /api/transactions/categorize-suggestions`

**Files:**
- Create: `app/api/transactions/categorize-suggestions/route.ts`
- Test: `app/api/transactions/categorize-suggestions/route.test.ts`

**Interfaces:**
- Consumes: `computeCategorizeSuggestions` and `CategorizeSuggestion` from Task 1 (`@/lib/calc/categorize-suggestions`); `categories` (field `isFallback`) and `transactions` from `@/lib/db/schema/*`; `auth` from `@/lib/auth`; `db` from `@/lib/db/client`.
- Produces: `GET` handler that returns `CategorizeSuggestion[]` as JSON (401 if not authenticated). Consumed by Task 3 (hook).

- [ ] **Step 1: Write the failing test**

Create `app/api/transactions/categorize-suggestions/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET /api/transactions/categorize-suggestions", () => {
  let userId: string;
  let accountId: string;
  let fallbackCategoryId: string;
  let foodCategoryId: string;
  let otherUserId: string;
  let otherAccountId: string;
  let otherCategoryId: string;

  beforeEach(async () => {
    const testId = `test-categorize-suggestions-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-categorize-suggestions-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Contanti", type: "Contanti", balance: "0.00" })
      .returning();
    accountId = account.id;

    const [fallbackCategory] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "variabile", isFallback: true })
      .returning();
    fallbackCategoryId = fallbackCategory.id;

    const [foodCategory] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();
    foodCategoryId = foodCategory.id;

    const otherTestId = `test-categorize-suggestions-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherTestId,
        name: "Other Test User",
        email: `test-categorize-suggestions-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    const [otherAccount] = await db
      .insert(accounts)
      .values({ userId: otherUserId, name: "Contanti Altro", type: "Contanti", balance: "0.00" })
      .returning();
    otherAccountId = otherAccount.id;

    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altro utente", type: "variabile" })
      .returning();
    otherCategoryId = otherCategory.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    expect(response.status).toBe(401);
  });

  it("suggerisce la categoria storica per una transazione da categorizzare con descrizione già vista", async () => {
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: foodCategoryId,
      description: "Esselunga",
      amount: "-30.00",
      date: "2026-01-05",
      source: "manuale",
    });
    const [uncategorized] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId: fallbackCategoryId,
        description: "esselunga",
        amount: "-25.00",
        date: "2026-02-01",
        source: "manuale",
      })
      .returning();

    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].transaction.id).toBe(uncategorized.id);
    expect(body[0].suggestedCategoryId).toBe(foodCategoryId);
  });

  it("esclude le transazioni senza nessun match storico", async () => {
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: fallbackCategoryId,
      description: "Merchant mai visto prima",
      amount: "-10.00",
      date: "2026-02-01",
      source: "manuale",
    });

    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    const body = await response.json();
    expect(body).toHaveLength(0);
  });

  it("non usa transazioni categorizzate di un altro utente come storico", async () => {
    await db.insert(transactions).values({
      userId: otherUserId,
      accountId: otherAccountId,
      categoryId: otherCategoryId,
      description: "Bar Centrale",
      amount: "-5.00",
      date: "2026-01-01",
      source: "manuale",
    });
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: fallbackCategoryId,
      description: "Bar Centrale",
      amount: "-5.00",
      date: "2026-02-01",
      source: "manuale",
    });

    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    const body = await response.json();
    expect(body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test app/api/transactions/categorize-suggestions/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (the file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `app/api/transactions/categorize-suggestions/route.ts`:

```ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { computeCategorizeSuggestions } from "@/lib/calc/categorize-suggestions";

/**
 * GET /api/transactions/categorize-suggestions — for each "Da categorizzare" transaction of the user
 * with at least one historical match (same description already categorized in the past), suggests the
 * most frequent category and, if consistent, the split percentage to propose again. No period
 * filter: considers the authenticated user's whole history.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userId = session.user.id;

  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallbackIds = new Set(userCategories.filter((category) => category.isFallback).map((c) => c.id));

  const allTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));

  const uncategorized = allTransactions.filter((transaction) => fallbackIds.has(transaction.categoryId));
  const historical = allTransactions.filter((transaction) => !fallbackIds.has(transaction.categoryId));

  const suggestions = computeCategorizeSuggestions(uncategorized, historical);

  return Response.json(suggestions);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm test app/api/transactions/categorize-suggestions/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/transactions/categorize-suggestions/route.ts app/api/transactions/categorize-suggestions/route.test.ts
git commit -m "feat: aggiungi endpoint GET /api/transactions/categorize-suggestions"
```

---

### Task 3: Hook `useCategorizeSuggestionsQuery`

**Files:**
- Modify: `lib/queries/transactions.ts`

**Interfaces:**
- Consumes: type `CategorizeSuggestion` from `@/lib/calc/categorize-suggestions` (Task 1); endpoint `GET /api/transactions/categorize-suggestions` (Task 2).
- Produces: `useCategorizeSuggestionsQuery(): UseQueryResult<CategorizeSuggestion[]>` with `enabled: false` — it does not start on mount, it must be invoked with `.refetch()`. Consumed by Task 4 (`AutoCategorizeButton`).

- [ ] **Step 1: Add the type import**

In `lib/queries/transactions.ts`, add at the top (below the existing imports):

```ts
import type { CategorizeSuggestion } from "@/lib/calc/categorize-suggestions";
```

- [ ] **Step 2: Add fetch function and hook**

Add at the bottom of `lib/queries/transactions.ts` (after `useDeleteTransactionMutation`):

```ts
async function fetchCategorizeSuggestions(): Promise<CategorizeSuggestion[]> {
  const response = await fetch("/api/transactions/categorize-suggestions");
  if (!response.ok) {
    throw new Error("Impossibile calcolare i suggerimenti di categorizzazione");
  }
  return response.json();
}

/** Automatic categorization suggestions based on history; does not start on mount, must be invoked with refetch(). */
export function useCategorizeSuggestionsQuery() {
  return useQuery({
    queryKey: ["transactions", "categorize-suggestions"] as const,
    queryFn: fetchCategorizeSuggestions,
    enabled: false,
  });
}
```

- [ ] **Step 3: Verify the type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors related to `lib/queries/transactions.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/transactions.ts
git commit -m "feat: aggiungi useCategorizeSuggestionsQuery"
```

---

### Task 4: UI — "Categorizza automaticamente" button + confirmation wizard

**Files:**
- Create: `components/domain/expenses/auto-categorize-wizard.tsx`
- Create: `components/domain/expenses/auto-categorize-button.tsx`
- Modify: `components/domain/expenses/index.ts`
- Modify: `app/(app)/spese/page.tsx`

**Interfaces:**
- Consumes: `CategorizeSuggestion` (Task 1), `useCategorizeSuggestionsQuery` and `useUpdateTransactionMutation` (Task 3 / existing in `lib/queries/transactions.ts`), `clampExcluded` from `./split-slider.utils`, `CategoryAvatar` from `@/components/domain/categories`, `Dialog*`/`Select*`/`Slider`/`Button` primitives from `@/components/ui/*`, existing `Category`/`CategoryColor`/`CategoryIcon`.
- Produces: `AutoCategorizeButton` (props: `categories: Category[]`, `currency: string`), used in `app/(app)/spese/page.tsx`.

- [ ] **Step 1: Create the wizard step component and the wizard**

Create `components/domain/expenses/auto-categorize-wizard.tsx`:

```tsx
"use client";

/** Sequential "Categorizza automaticamente" wizard: proposes category and split for "Da categorizzare" transactions with a historical match, one at a time, with explicit confirmation for each. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { CategoryAvatar } from "@/components/domain/categories";
import { formatCurrency } from "@/lib/format";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { CategorizeSuggestion } from "@/lib/calc/categorize-suggestions";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { clampExcluded } from "./split-slider.utils";

interface AutoCategorizeStepProps {
  suggestion: CategorizeSuggestion;
  categories: Category[];
  currency: string;
  index: number;
  total: number;
  isPending: boolean;
  hasError: boolean;
  onSkip: () => void;
  onConfirm: (categoryId: string, excludedAmount: number) => void;
}

/** `key` set by the caller: a remount for each new suggestion resets the local state without syncing via effect. */
function AutoCategorizeStep({
  suggestion,
  categories,
  currency,
  index,
  total,
  isPending,
  hasError,
  onSkip,
  onConfirm,
}: AutoCategorizeStepProps) {
  const totalAmount = Math.abs(Number(suggestion.transaction.amount));
  const [categoryId, setCategoryId] = React.useState(suggestion.suggestedCategoryId);
  const [excluded, setExcluded] = React.useState(() =>
    clampExcluded((suggestion.suggestedSplitPercentage ?? 0) * totalAmount, totalAmount)
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Rivedi categorizzazione ({index + 1} di {total})
        </DialogTitle>
        <DialogDescription>
          Basato su {suggestion.matchCount} transazioni passate categorizzate così.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{suggestion.transaction.description}</p>
          <p className="text-xs text-muted-foreground">
            {suggestion.transaction.date} · {formatCurrency(totalAmount, currency)}
          </p>
        </div>

        <Select value={categoryId} onValueChange={(value) => value && setCategoryId(value)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue>
              {(value: string) => {
                const selected = categories.find((c) => c.id === value);
                if (!selected) return "";
                return (
                  <span className="flex items-center gap-1.5">
                    <CategoryAvatar
                      color={selected.color as CategoryColor}
                      icon={selected.icon as CategoryIcon}
                      size={10}
                      className="size-4"
                    />
                    {selected.name}
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <span className="flex items-center gap-1.5">
                  <CategoryAvatar
                    color={category.color as CategoryColor}
                    icon={category.icon as CategoryIcon}
                    size={10}
                    className="size-4"
                  />
                  {category.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Dividi (quota esclusa dal conteggio)</p>
          <Slider
            value={[excluded]}
            min={0}
            max={totalAmount}
            step={0.01}
            onValueChange={(value) =>
              setExcluded(clampExcluded(Array.isArray(value) ? value[0] : value, totalAmount))
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
            <span>Esclusa: {formatCurrency(excluded, currency)}</span>
          </div>
        </div>

        {hasError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSkip} disabled={isPending}>
          Salta
        </Button>
        <Button type="button" onClick={() => onConfirm(categoryId, excluded)} disabled={isPending}>
          {isPending ? "Salvataggio..." : "Conferma"}
        </Button>
      </DialogFooter>
    </>
  );
}

export interface AutoCategorizeWizardProps {
  suggestions: CategorizeSuggestion[];
  categories: Category[];
  currency: string;
  onClose: () => void;
}

export function AutoCategorizeWizard({ suggestions, categories, currency, onClose }: AutoCategorizeWizardProps) {
  const updateMutation = useUpdateTransactionMutation();
  const [index, setIndex] = React.useState(0);
  const [appliedCount, setAppliedCount] = React.useState(0);

  const current = suggestions[index];
  const isDone = index >= suggestions.length;

  function handleConfirm(categoryId: string, excludedAmount: number) {
    if (!current) return;
    updateMutation.mutate(
      { id: current.transaction.id, input: { categoryId, excludedAmount } },
      {
        onSuccess: () => {
          setAppliedCount((n) => n + 1);
          setIndex((i) => i + 1);
        },
      }
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {isDone || !current ? (
          <>
            <DialogHeader>
              <DialogTitle>Categorizzazione completata</DialogTitle>
              <DialogDescription>
                Applicate {appliedCount} di {suggestions.length} transazioni.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Chiudi
              </Button>
            </DialogFooter>
          </>
        ) : (
          <AutoCategorizeStep
            key={current.transaction.id}
            suggestion={current}
            categories={categories}
            currency={currency}
            index={index}
            total={suggestions.length}
            isPending={updateMutation.isPending}
            hasError={updateMutation.isError}
            onSkip={() => setIndex((i) => i + 1)}
            onConfirm={handleConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create the trigger button**

Create `components/domain/expenses/auto-categorize-button.tsx`:

```tsx
"use client";

/** "Categorizza automaticamente" button: scans the "Da categorizzare" transactions and opens the confirmation wizard if it finds suggestions. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useCategorizeSuggestionsQuery } from "@/lib/queries/transactions";
import type { Category } from "@/lib/db/schema/categories";
import type { CategorizeSuggestion } from "@/lib/calc/categorize-suggestions";
import { AutoCategorizeWizard } from "./auto-categorize-wizard";

export interface AutoCategorizeButtonProps {
  categories: Category[];
  currency: string;
}

export function AutoCategorizeButton({ categories, currency }: AutoCategorizeButtonProps) {
  const { refetch, isFetching, isError } = useCategorizeSuggestionsQuery();
  const [wizardSuggestions, setWizardSuggestions] = React.useState<CategorizeSuggestion[] | null>(null);
  const [showEmptyMessage, setShowEmptyMessage] = React.useState(false);

  async function handleClick() {
    setShowEmptyMessage(false);
    const result = await refetch();
    const suggestions = result.data ?? [];
    if (suggestions.length === 0) {
      setShowEmptyMessage(true);
      return;
    }
    setWizardSuggestions(suggestions);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isFetching}>
        {isFetching ? "Ricerca in corso..." : "Categorizza automaticamente"}
      </Button>
      {showEmptyMessage && (
        <p className="text-xs text-muted-foreground">Nessuna transazione simile trovata da suggerire.</p>
      )}
      {isError && <p className="text-xs text-destructive">Scansione non riuscita, riprova.</p>}
      {wizardSuggestions && (
        <AutoCategorizeWizard
          suggestions={wizardSuggestions}
          categories={categories}
          currency={currency}
          onClose={() => setWizardSuggestions(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Export the new components from the barrel**

In `components/domain/expenses/index.ts`, add at the bottom:

```ts
export { AutoCategorizeButton } from "./auto-categorize-button";
export type { AutoCategorizeButtonProps } from "./auto-categorize-button";
export { AutoCategorizeWizard } from "./auto-categorize-wizard";
export type { AutoCategorizeWizardProps } from "./auto-categorize-wizard";
```

- [ ] **Step 4: Integrate the button in the Spese page**

In `app/(app)/spese/page.tsx`:

Change the import (lines 6-15) by adding `AutoCategorizeButton`:

```tsx
import {
  AddTransactionForm,
  AutoCategorizeButton,
  CategoryBreakdownDonut,
  ExpensesFilterBar,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpensesReferenceNav,
  ExpenseTrendChart,
  TransactionRow,
} from "@/components/domain/expenses";
```

In the header row (after the "Gestisci categorie" link, before the `{uncategorizedCount > 0 && (...)}` block), add:

```tsx
        <a
          href="/categorie"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Gestisci categorie
        </a>
        <AutoCategorizeButton categories={safeCategories} currency={currency} />
        {uncategorizedCount > 0 && (
```

(replaces the two existing lines `</a>` followed by `{uncategorizedCount > 0 && (` with the three lines above — the only change is inserting the `<AutoCategorizeButton .../>` line in between).

- [ ] **Step 5: Verify type-check, lint and build**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no new errors (the project already has 2 known pre-existing warnings on `react-hooks/set-state-in-effect`, not touched by this task).

Run: `pnpm build`
Expected: build completed without errors.

- [ ] **Step 6: Commit**

```bash
git add components/domain/expenses/auto-categorize-wizard.tsx components/domain/expenses/auto-categorize-button.tsx components/domain/expenses/index.ts "app/(app)/spese/page.tsx"
git commit -m "feat: aggiungi bottone e wizard Categorizza automaticamente in Spese"
```

---

## Manual user verification (outside agent scope)

No Postgres/Redis available in the agentic sandbox for a real browser (same constraint as the previous Spese/Categorie features). To verify manually at the end of the implementation:
- The button appears and, with no match, shows the message "Nessuna transazione simile trovata da suggerire".
- With at least one match, the wizard opens, shows the correct category and (if present) split, allows editing them, "Salta" advances without saving, "Conferma" saves and advances.
- Closing the wizard halfway leaves the confirmations already made applied.
- The final summary shows the correct count of applied transactions.
