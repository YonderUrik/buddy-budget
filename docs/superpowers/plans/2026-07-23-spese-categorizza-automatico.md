# Categorizza automaticamente in Spese — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere in Spese un bottone "Categorizza automaticamente" che suggerisce categoria (e split) per le transazioni "Da categorizzare" basandosi su descrizioni identiche già categorizzate in passato, con conferma esplicita transazione per transazione in un wizard sequenziale.

**Architecture:** Motore di calcolo puro (`computeCategorizeSuggestions`) → nuovo endpoint `GET /api/transactions/categorize-suggestions` che lo invoca sui dati dell'utente → hook TanStack Query lazy (`enabled: false`) → componente `AutoCategorizeButton` (trigger + stato zero-risultati) che apre `AutoCategorizeWizard` (dialog sequenziale), il quale riusa il PATCH transazione già esistente per applicare ogni conferma.

**Tech Stack:** Next.js Route Handlers, Drizzle ORM, TanStack Query, Zod (nessuno schema nuovo: riusa `updateTransactionSchema`), vitest, componenti `@base-ui/react` via `components/ui/*` (Dialog, Select, Slider, Button).

## Global Constraints

- Match solo su `description` esatta (case-insensitive, trim), nessun fuzzy/token matching.
- Nessun filtro periodo nello scan: considera tutto lo storico dell'utente.
- Nessun nuovo endpoint di scrittura: l'applicazione dei suggerimenti riusa `PATCH /api/transactions/[id]`.
- Categoria suggerita = più frequente tra i match storici; pareggio → quella con la transazione più recente (`date` desc) tra le candidate a pari conteggio.
- Percentuale split suggerita calcolata solo sui match della categoria vincente; coerente (tutte uguali, arrotondate a 4 decimali) → quella percentuale, altrimenti `null` (nessuna proposta, editabile a 0 di default).
- Wizard sequenziale (una transazione alla volta), categoria e split sempre editabili prima di confermare; "Salta" non applica nulla; chiusura anticipata lascia applicate le conferme già fatte.
- Stringhe utente in italiano (nessuna i18n).
- Tutte le stringhe visibili derivano da questa spec, nessun valore hardcoded di colore/raggio (riusa i token tema esistenti).

---

### Task 1: Motore di calcolo puro `computeCategorizeSuggestions`

**Files:**
- Create: `lib/calc/categorize-suggestions.ts`
- Test: `lib/calc/categorize-suggestions.test.ts`

**Interfaces:**
- Consumes: tipo `Transaction` da `@/lib/db/schema/transactions` (campi usati: `id`, `categoryId`, `description`, `amount`, `excludedAmount`, `date`).
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
  Usato da Task 2 (route handler).

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `lib/calc/categorize-suggestions.test.ts`:

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm test lib/calc/categorize-suggestions.test.ts`
Expected: FAIL — `Cannot find module './categorize-suggestions'` (il file non esiste ancora).

- [ ] **Step 3: Scrivi l'implementazione**

Crea `lib/calc/categorize-suggestions.ts`:

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

/** Percentuale di importo esclusa dal conteggio ("Dividi"), arrotondata per confronti di coerenza tra transazioni diverse. */
function splitPercentage(transaction: Transaction): number {
  const amount = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  if (amount === 0) return 0;
  return Math.round((excluded / amount) * 10000) / 10000;
}

/**
 * Per ogni transazione "Da categorizzare" con almeno un match storico (stessa descrizione, esatta
 * case-insensitive), suggerisce la categoria più frequente tra i match (pareggio → la più recente) e,
 * se lo split storico della categoria vincente è coerente, la percentuale da riproporre.
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

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm test lib/calc/categorize-suggestions.test.ts`
Expected: PASS (7 test)

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
- Consumes: `computeCategorizeSuggestions` e `CategorizeSuggestion` da Task 1 (`@/lib/calc/categorize-suggestions`); `categories` (campo `isFallback`) e `transactions` da `@/lib/db/schema/*`; `auth` da `@/lib/auth`; `db` da `@/lib/db/client`.
- Produces: `GET` handler che ritorna `CategorizeSuggestion[]` in JSON (401 se non autenticato). Consumato da Task 3 (hook).

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `app/api/transactions/categorize-suggestions/route.test.ts`:

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm test app/api/transactions/categorize-suggestions/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (il file non esiste ancora).

- [ ] **Step 3: Scrivi l'implementazione**

Crea `app/api/transactions/categorize-suggestions/route.ts`:

```ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { computeCategorizeSuggestions } from "@/lib/calc/categorize-suggestions";

/**
 * GET /api/transactions/categorize-suggestions — per ogni transazione "Da categorizzare" dell'utente
 * con almeno un match storico (stessa descrizione già categorizzata in passato), suggerisce la
 * categoria più frequente e, se coerente, la percentuale di split da riproporre. Nessun filtro
 * periodo: considera l'intero storico dell'utente autenticato.
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

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm test app/api/transactions/categorize-suggestions/route.test.ts`
Expected: PASS (4 test)

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
- Consumes: tipo `CategorizeSuggestion` da `@/lib/calc/categorize-suggestions` (Task 1); endpoint `GET /api/transactions/categorize-suggestions` (Task 2).
- Produces: `useCategorizeSuggestionsQuery(): UseQueryResult<CategorizeSuggestion[]>` con `enabled: false` — non parte al mount, va invocata con `.refetch()`. Consumato da Task 4 (`AutoCategorizeButton`).

- [ ] **Step 1: Aggiungi l'import del tipo**

In `lib/queries/transactions.ts`, aggiungi in cima (sotto gli import esistenti):

```ts
import type { CategorizeSuggestion } from "@/lib/calc/categorize-suggestions";
```

- [ ] **Step 2: Aggiungi fetch function e hook**

Aggiungi in fondo a `lib/queries/transactions.ts` (dopo `useDeleteTransactionMutation`):

```ts
async function fetchCategorizeSuggestions(): Promise<CategorizeSuggestion[]> {
  const response = await fetch("/api/transactions/categorize-suggestions");
  if (!response.ok) {
    throw new Error("Impossibile calcolare i suggerimenti di categorizzazione");
  }
  return response.json();
}

/** Suggerimenti di categorizzazione automatica basati sullo storico; non parte al mount, va invocata con refetch(). */
export function useCategorizeSuggestionsQuery() {
  return useQuery({
    queryKey: ["transactions", "categorize-suggestions"] as const,
    queryFn: fetchCategorizeSuggestions,
    enabled: false,
  });
}
```

- [ ] **Step 3: Verifica il type-check**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore relativo a `lib/queries/transactions.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/transactions.ts
git commit -m "feat: aggiungi useCategorizeSuggestionsQuery"
```

---

### Task 4: UI — bottone "Categorizza automaticamente" + wizard di conferma

**Files:**
- Create: `components/domain/expenses/auto-categorize-wizard.tsx`
- Create: `components/domain/expenses/auto-categorize-button.tsx`
- Modify: `components/domain/expenses/index.ts`
- Modify: `app/(app)/spese/page.tsx`

**Interfaces:**
- Consumes: `CategorizeSuggestion` (Task 1), `useCategorizeSuggestionsQuery` e `useUpdateTransactionMutation` (Task 3 / esistente in `lib/queries/transactions.ts`), `clampExcluded` da `./split-slider.utils`, `CategoryAvatar` da `@/components/domain/categories`, primitive `Dialog*`/`Select*`/`Slider`/`Button` da `@/components/ui/*`, `Category`/`CategoryColor`/`CategoryIcon` esistenti.
- Produces: `AutoCategorizeButton` (props: `categories: Category[]`, `currency: string`), usato in `app/(app)/spese/page.tsx`.

- [ ] **Step 1: Crea il componente step del wizard e il wizard**

Crea `components/domain/expenses/auto-categorize-wizard.tsx`:

```tsx
"use client";

/** Wizard sequenziale "Categorizza automaticamente": propone categoria e split per le transazioni "Da categorizzare" con match storico, una alla volta, con conferma esplicita per ciascuna. */

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

/** Chiave in `key` sul chiamante: un remount per ogni nuovo suggerimento resetta lo stato locale senza sincronizzazioni via effect. */
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

- [ ] **Step 2: Crea il bottone trigger**

Crea `components/domain/expenses/auto-categorize-button.tsx`:

```tsx
"use client";

/** Bottone "Categorizza automaticamente": scansiona le transazioni "Da categorizzare" e apre il wizard di conferma se trova suggerimenti. */

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

- [ ] **Step 3: Esporta i nuovi componenti dal barrel**

In `components/domain/expenses/index.ts`, aggiungi in fondo:

```ts
export { AutoCategorizeButton } from "./auto-categorize-button";
export type { AutoCategorizeButtonProps } from "./auto-categorize-button";
export { AutoCategorizeWizard } from "./auto-categorize-wizard";
export type { AutoCategorizeWizardProps } from "./auto-categorize-wizard";
```

- [ ] **Step 4: Integra il bottone nella pagina Spese**

In `app/(app)/spese/page.tsx`:

Modifica l'import (riga 6-15) aggiungendo `AutoCategorizeButton`:

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

Nella riga dell'header (dopo il link "Gestisci categorie", prima del blocco `{uncategorizedCount > 0 && (...)}`), aggiungi:

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

(sostituisce le due righe esistenti `</a>` seguita da `{uncategorizedCount > 0 && (` con le tre righe sopra — l'unica modifica è l'inserimento della riga `<AutoCategorizeButton .../>` in mezzo).

- [ ] **Step 5: Verifica type-check, lint e build**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

Run: `pnpm lint`
Expected: nessun nuovo errore (il progetto ha già 2 warning noti pre-esistenti su `react-hooks/set-state-in-effect`, non toccati da questo task).

Run: `pnpm build`
Expected: build completata senza errori.

- [ ] **Step 6: Commit**

```bash
git add components/domain/expenses/auto-categorize-wizard.tsx components/domain/expenses/auto-categorize-button.tsx components/domain/expenses/index.ts "app/(app)/spese/page.tsx"
git commit -m "feat: aggiungi bottone e wizard Categorizza automaticamente in Spese"
```

---

## Verifica manuale utente (fuori scope agente)

Nessun Postgres/Redis disponibile nel sandbox agentico per un browser reale (stesso vincolo delle feature precedenti su Spese/Categorie). Da verificare manualmente a fine implementazione:
- Il bottone appare e, senza match, mostra il messaggio "Nessuna transazione simile trovata da suggerire".
- Con almeno un match, il wizard si apre, mostra la categoria e (se presente) lo split corretti, permette di modificarli, "Salta" avanza senza salvare, "Conferma" salva e avanza.
- Chiudere il wizard a metà lascia applicate le conferme già fatte.
- Il riepilogo finale mostra il conteggio corretto di transazioni applicate.
