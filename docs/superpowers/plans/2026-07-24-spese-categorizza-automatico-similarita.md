# Categorizza automaticamente — match per similarità Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il match esatto sulla descrizione nel motore di suggerimenti "Categorizza automaticamente" con un match per similarità a token (Jaccard, numeri scartati), così suffissi/codici variabili e filiali diverse dello stesso merchant vengono riconosciuti come simili; mostrare la percentuale di somiglianza nel wizard.

**Architecture:** `computeCategorizeSuggestions` confronta ogni transazione da categorizzare contro ogni transazione storica con un indice di Jaccard sui token normalizzati (numeri scartati), invece del lookup esatto su mappa attuale. Aggregazione per categoria vincente invariata (più frequente, pareggio → più recente); nuovo campo `averageSimilarity` nell'output, mostrato nel wizard.

**Tech Stack:** TypeScript puro (nessuna nuova dipendenza), vitest.

## Global Constraints

- Soglia di similarità: `SIMILARITY_THRESHOLD = 0.5`, inclusiva (`≥`).
- Similarità = indice di Jaccard tra insiemi di token (parole), scartati i token puramente numerici (`^\d+$`).
- Se uno dei due insiemi di token è vuoto (descrizione interamente numerica), il confronto ricade sull'uguaglianza esatta della stringa normalizzata (niente Jaccard su insiemi vuoti).
- Nessun peso per punteggio di similarità nella scelta della categoria vincente o nel calcolo dello split: un match sopra soglia conta come un match, indipendentemente dal suo punteggio.
- `averageSimilarity` = media dei punteggi di similarità dei soli match della categoria vincente, arrotondata a 2 decimali.
- Scope limitato al motore del wizard manuale (`lib/calc/categorize-suggestions.ts`). L'auto-categorizzazione all'import GoCardless (`lib/gocardless/categorize.ts`) resta a match esatto, non toccata da questo piano.
- Nessuna modifica a endpoint (`route.ts`) o hook (`lib/queries/transactions.ts`): il nuovo campo attraversa la serializzazione JSON esistente senza cambi di schema.
- Stringhe utente in italiano (nessuna i18n).

---

### Task 1: Motore di similarità in `computeCategorizeSuggestions`

**Files:**
- Modify: `lib/calc/categorize-suggestions.ts`
- Modify: `lib/calc/categorize-suggestions.test.ts`

**Interfaces:**
- Consumes: tipo `Transaction` da `@/lib/db/schema/transactions` (invariato).
- Produces:
  ```ts
  export interface CategorizeSuggestion {
    transaction: Transaction;
    suggestedCategoryId: string;
    matchCount: number;
    suggestedSplitPercentage: number | null;
    averageSimilarity: number; // NUOVO
  }
  export function computeCategorizeSuggestions(
    uncategorized: Transaction[],
    historical: Transaction[]
  ): CategorizeSuggestion[]
  ```
  Stessa firma di prima (nessun cambio per i chiamanti in Task 2 dell'endpoint, già esistente e non toccato). Usato da Task 2 di questo piano (wizard UI, campo `averageSimilarity`).

- [ ] **Step 1: Scrivi i test che fallisce (nuovi casi + i 6 esistenti restano)**

Sostituisci interamente il contenuto di `lib/calc/categorize-suggestions.test.ts` con:

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm test lib/calc/categorize-suggestions.test.ts`
Expected: FAIL — i nuovi test (suffisso, filiale, sotto soglia, numerica, media) falliscono perché il matching esatto attuale non riconosce descrizioni diverse come simili, e `averageSimilarity` non esiste ancora nell'output.

- [ ] **Step 3: Scrivi l'implementazione**

Sostituisci interamente il contenuto di `lib/calc/categorize-suggestions.ts` con:

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

/** Insieme di parole significative di una descrizione: normalizzata, spezzata su spazi/punteggiatura, scartati i token puramente numerici (codici transazione, numeri civici, riferimenti). */
function tokenize(description: string): Set<string> {
  const tokens = normalizeDescription(description)
    .split(/[^a-z0-9à-ÿ]+/)
    .filter((token) => token.length > 0 && !/^\d+$/.test(token));
  return new Set(tokens);
}

/** Indice di Jaccard tra due insiemi di token: |intersezione| / |unione|. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize += 1;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Somiglianza tra due descrizioni: Jaccard sui token normalizzati (numeri scartati). Se una delle due
 * non ha token significativi (descrizione interamente numerica), ricade sull'uguaglianza esatta della
 * stringa normalizzata invece di confrontare insiemi vuoti.
 */
function descriptionSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return normalizeDescription(a) === normalizeDescription(b) ? 1 : 0;
  }
  return jaccardSimilarity(tokensA, tokensB);
}

/** Percentuale di importo esclusa dal conteggio ("Dividi"), arrotondata per confronti di coerenza tra transazioni diverse. */
function splitPercentage(transaction: Transaction): number {
  const amount = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  if (amount === 0) return 0;
  return Math.round((excluded / amount) * 10000) / 10000;
}

/**
 * Per ogni transazione "Da categorizzare" con almeno un match storico simile (Jaccard sui token di
 * descrizione, numeri scartati, soglia 0.5), suggerisce la categoria più frequente tra i match
 * (pareggio → la più recente) e, se lo split storico della categoria vincente è coerente, la
 * percentuale da riproporre, insieme alla somiglianza media dei match vincenti.
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

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm test lib/calc/categorize-suggestions.test.ts`
Expected: PASS (11 test)

- [ ] **Step 5: Commit**

```bash
git add lib/calc/categorize-suggestions.ts lib/calc/categorize-suggestions.test.ts
git commit -m "feat: match per similarità (Jaccard su token) nel motore di categorizzazione automatica"
```

---

### Task 2: Mostra la somiglianza media nel wizard

**Files:**
- Modify: `components/domain/expenses/auto-categorize-wizard.tsx`

**Interfaces:**
- Consumes: `CategorizeSuggestion.averageSimilarity` (Task 1, già presente su ogni oggetto passato come prop `suggestion` al componente `AutoCategorizeStep`).
- Produces: nessuna nuova interfaccia — solo cambio di testo visualizzato.

- [ ] **Step 1: Aggiorna la riga di sottotitolo dello step**

In `components/domain/expenses/auto-categorize-wizard.tsx`, trova:

```tsx
        <DialogDescription>
          Basato su {suggestion.matchCount} transazioni passate categorizzate così.
        </DialogDescription>
```

Sostituiscila con:

```tsx
        <DialogDescription>
          Basato su {suggestion.matchCount} transazioni simili (
          {Math.round(suggestion.averageSimilarity * 100)}% di somiglianza media).
        </DialogDescription>
```

- [ ] **Step 2: Verifica type-check, lint e build**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

Run: `pnpm lint`
Expected: nessun nuovo errore (il progetto ha già 2 warning noti pre-esistenti su `react-hooks/set-state-in-effect`, non toccati da questo task).

Run: `pnpm build`
Expected: build completata senza errori.

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/auto-categorize-wizard.tsx
git commit -m "feat: mostra la somiglianza media nel wizard Categorizza automaticamente"
```

---

## Verifica manuale utente (fuori scope agente)

Nessun Postgres/Redis disponibile nel sandbox agentico per un browser reale (stesso vincolo delle feature precedenti su Spese/Categorie). Da verificare manualmente a fine implementazione:
- Con transazioni storiche dalla stessa descrizione esatta, il wizard mostra ancora "100% di somiglianza media" e si comporta come prima.
- Con una transazione da categorizzare simile (non identica) a una storica — es. stesso merchant con codice/filiale diversi — il bottone la trova e il wizard mostra una percentuale inferiore a 100%.
- Con transazioni completamente diverse, il bottone continua a mostrare "Nessuna transazione simile trovata da suggerire."
