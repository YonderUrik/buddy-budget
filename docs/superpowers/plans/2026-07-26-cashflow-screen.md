# Cash flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Cash flow screen (income vs. expense comparison, 12-month trend, income sources, "where every euro goes", accumulated savings) and the minimal generalization of the Spese screen needed to record income transactions in the first place.

**Architecture:** Extend `categoryTypeEnum` with a third value `"entrata"`; income/expense direction is derived from `amount` sign (already the case) and validated server-side against the chosen category's `type`. A new pure calc module `lib/calc/cashflow.ts` computes all Cash flow KPIs/series from the same `transactions`/`categories` data already used by Spese, fetched client-side via TanStack Query and computed in the browser — no new API routes. The Spese screen is relabeled "Transazioni" and gains a minimal type toggle (Tutte/Uscite/Entrate) on the list only; its existing KPI/donut/trend widgets stay expense-only, unaffected by the toggle.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM + Postgres, TanStack Query, Zod, Recharts via shadcn `Chart`, vitest.

## Global Constraints

- Tutte le stringhe visibili in italiano (i18n non ancora implementata).
- Nessun colore/raggio hardcoded: usa i token Tailwind/CSS var esistenti (`--pos`, `--neg`, `--chart-1`, `--chart-2`, `SWATCH_CHART_COLOR`).
- JSDoc minimo (una riga `/** ... */`) su ogni componente/funzione pubblica nuova.
- Barrel file (`index.ts`) per ogni cartella componenti nuova o toccata; import esterni sempre dal barrel.
- Tipi delle props dei componenti pubblici sempre esportati.
- Layer architecture: `components/domain/**` non dipende da `app/**`; `app/**` orchestra.
- Package manager: `pnpm`. Test: `pnpm test` (= `vitest run`). Nessuno script `typecheck` dedicato: usa `pnpm exec tsc --noEmit` per la verifica di tipo dei task che toccano solo componenti/pagine React (nessuna convenzione di test automatico per `.tsx` in questo repo — solo `lib/calc/*.test.ts` e `app/api/**/route.test.ts` esistono).
- **`pnpm db:push` va sempre eseguito dall'utente, mai da un agente** (convenzione consolidata di questo progetto — vedi CLAUDE.md). Il Task 1 include un checkpoint esplicito che richiede questo passaggio manuale prima di proseguire.
- I test API (`route.test.ts`) girano contro un Postgres reale via `db`/`client` di `lib/db/client` — nessun mock del DB, solo mock di `auth.api.getSession`.

---

## File Structure

**Create:**
- `components/domain/expenses/transactions-type-toggle.tsx` — toggle Tutte/Uscite/Entrate per la lista transazioni.
- `lib/calc/cashflow.ts` — motore di calcolo puro Cash flow.
- `lib/calc/cashflow.test.ts` — test del motore.
- `components/domain/cashflow/cashflow-period-selector.tsx` — pillole 3M/6M/12M/24M.
- `components/domain/cashflow/cashflow-reference-nav.tsx` — frecce prev/next sul periodo.
- `components/domain/cashflow/cashflow-kpi-cards.tsx` — 4 KPI.
- `components/domain/cashflow/cashflow-trend-chart.tsx` — barre affiancate entrate/uscite.
- `components/domain/cashflow/income-sources-list.tsx` — lista "Fonti di entrata".
- `components/domain/cashflow/where-it-goes-breakdown.tsx` — blocco "Dove va ogni euro".
- `components/domain/cashflow/accumulated-savings-chart.tsx` — grafico "Risparmio accumulato".
- `components/domain/cashflow/index.ts` — barrel.
- `app/(app)/cash-flow/page.tsx` — pagina orchestrazione (sola lettura).

**Modify:**
- `lib/db/schema/categories.ts` — enum `+"entrata"`, 3 nuove `DEFAULT_CATEGORIES` di entrata, fix icona `"shield"` mancante (bug pre-esistente, blocca il file di test che questo task deve comunque toccare).
- `lib/db/schema/categories.test.ts` — conteggio e assert aggiornati.
- `lib/validation/categories.ts` — `createCategorySchema`/`updateCategorySchema` enum type `+"entrata"`.
- `components/domain/categories/add-category-form.tsx` — opzione "Entrata".
- `components/domain/categories/category-row.tsx` — opzione "Entrata".
- `lib/calc/expenses.ts` — `isIncome`, `filterByTransactionType`, filtro entrata in `computeCategoryBreakdown`, export di `startOfMonth`/`endOfMonth`/`addMonths` (riusati da `cashflow.ts`).
- `lib/calc/expenses.test.ts` — test delle aggiunte sopra.
- `app/api/transactions/route.ts` — `GET` parametro `type`, `POST` segno derivato dalla categoria.
- `app/api/transactions/route.test.ts` — test delle modifiche sopra.
- `app/api/transactions/[id]/route.ts` — `PATCH` segno derivato + guard di compatibilità direzione/categoria.
- `app/api/transactions/[id]/route.test.ts` — test delle modifiche sopra.
- `lib/queries/transactions.ts` — `useTransactionsQuery` accetta un parametro `type`.
- `components/domain/expenses/add-transaction-form.tsx` — toggle Spesa/Entrata, filtro categorie.
- `components/domain/expenses/transaction-row.tsx` — select categoria filtrato per direzione, "Dividi" nascosto per le entrate.
- `components/domain/expenses/index.ts` — export `TransactionsTypeToggle`.
- `app/(app)/spese/page.tsx` — rinomina a "Transazioni", toggle tipo lista, widget di analisi sempre uscite-only.
- `components/layout/sidebar.tsx` — label nav `"Spese"` → `"Transazioni"`.

---

### Task 1: Categorie di entrata — schema, validazione, seed, UI

**Files:**
- Modify: `lib/db/schema/categories.ts`
- Modify: `lib/db/schema/categories.test.ts`
- Modify: `lib/validation/categories.ts`
- Modify: `components/domain/categories/add-category-form.tsx`
- Modify: `components/domain/categories/category-row.tsx`

**Interfaces:**
- Produce: `categoryTypeEnum` con valori `["fissa", "variabile", "entrata"]`; `Category["type"]: "fissa" | "variabile" | "entrata"`; `createCategorySchema`/`updateCategorySchema` con lo stesso enum esteso — usati da tutti i task successivi che leggono/scrivono categorie.

- [ ] **Step 1: Scrivi il test che verifica il nuovo conteggio e le nuove categorie di entrata**

Sostituisci il contenuto di `lib/db/schema/categories.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/validation/categories";
import { DEFAULT_CATEGORIES } from "./categories";

describe("DEFAULT_CATEGORIES", () => {
  it("ha 18 categorie", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(18);
  });

  it("ogni categoria ha icona e colore validi", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICONS).toContain(category.icon);
      expect(CATEGORY_COLORS).toContain(category.color);
    }
  });

  it("solo 'Da categorizzare' è isFallback", () => {
    const fallbackEntries = DEFAULT_CATEGORIES.filter((c) => c.isFallback === true);
    expect(fallbackEntries).toHaveLength(1);
    expect(fallbackEntries[0].name).toBe("Da categorizzare");
  });

  it("ha 3 categorie di tipo entrata: Stipendio, Freelance, Dividendi e interessi", () => {
    const incomeEntries = DEFAULT_CATEGORIES.filter((c) => c.type === "entrata");
    expect(incomeEntries.map((c) => c.name).sort()).toEqual(
      ["Dividendi e interessi", "Freelance", "Stipendio"].sort()
    );
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm test lib/db/schema/categories.test.ts`
Expected: FAIL — conteggio attuale è 15 (non 18), nessuna categoria `type === "entrata"` esiste ancora, e prima ancora il test "icona/colore validi" fallisce già oggi (bug pre-esistente: `"shield"` in `Assicurazioni & Tasse` non è in `CATEGORY_ICONS`).

- [ ] **Step 3: Estendi l'enum e i tipi di validazione**

In `lib/validation/categories.ts`, sostituisci le righe 22-40:

```typescript
export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["fissa", "variabile", "entrata"]),
  color: z.enum(CATEGORY_COLORS).optional(),
  icon: z.enum(CATEGORY_ICONS).optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.enum(["fissa", "variabile", "entrata"]).optional(),
    color: z.enum(CATEGORY_COLORS).optional(),
    icon: z.enum(CATEGORY_ICONS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

Aggiungi anche `"shield"` a `CATEGORY_ICONS` (riga 7-19), tra `"paw-print"` e `"shirt"` (fix del bug pre-esistente che blocca il test allo Step 2):

```typescript
export const CATEGORY_ICONS = [
  "utensils", "shopping-cart", "home", "zap", "droplet", "wifi", "tv",
  "smartphone", "car", "bus", "plane", "fuel", "film", "gamepad-2",
  "music", "heart", "stethoscope", "dumbbell", "graduation-cap", "baby",
  "paw-print", "shield", "shirt", "scissors", "gift", "briefcase", "wrench",
  "package", "help-circle",
  "wallet", "credit-card", "piggy-bank", "banknote", "landmark", "receipt",
  "trending-up", "coins", "flame", "sofa", "hammer", "paintbrush",
  "laptop", "headphones", "camera", "printer", "train-front", "ship",
  "map-pin", "luggage", "coffee", "pizza", "wine", "cake", "pill",
  "activity", "glasses", "book-open", "palette", "bike", "calculator",
  "watch",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
```

In `lib/db/schema/categories.ts`, cambia riga 5:

```typescript
export const categoryTypeEnum = pgEnum("category_type", ["fissa", "variabile", "entrata"]);
```

E aggiorna la firma dell'array `DEFAULT_CATEGORIES` (riga 27-32) e aggiungi le 3 nuove voci in fondo all'array (dopo `"Da categorizzare"`, riga 55):

```typescript
export const DEFAULT_CATEGORIES: {
  name: string;
  type: "fissa" | "variabile" | "entrata";
  icon: string; // Es. Lucide Icons
  color: string;
  isFallback?: boolean;
}[] = [
  // --- SPESE FISSE (I tuoi impegni mensili/annuali) ---
  { name: "Affitto & Mutuo", type: "fissa", icon: "home", color: "slate" },
  { name: "Bollette & Utenze", type: "fissa", icon: "zap", color: "yellow" },
  { name: "Abbonamenti", type: "fissa", icon: "tv", color: "purple" },
  { name: "Assicurazioni & Tasse", type: "fissa", icon: "shield", color: "indigo" },
  { name: "Risparmi & Investimenti", type: "fissa", icon: "piggy-bank", color: "emerald" },

  // --- NECESSITÀ VARIABILI (Devi farle, ma l'importo cambia) ---
  { name: "Spesa alimentare", type: "variabile", icon: "shopping-cart", color: "green" },
  { name: "Trasporti & Auto", type: "variabile", icon: "car", color: "blue" },
  { name: "Salute & Cura", type: "variabile", icon: "heart", color: "rose" },

  // --- STILE DI VITA (Discrezionali, dove puoi tagliare se serve) ---
  { name: "Ristoranti & Bar", type: "variabile", icon: "utensils", color: "orange" },
  { name: "Shopping", type: "variabile", icon: "shopping-bag", color: "pink" },
  { name: "Svago & Hobbies", type: "variabile", icon: "smile", color: "teal" },
  { name: "Viaggi", type: "variabile", icon: "plane", color: "cyan" },
  { name: "Regali", type: "variabile", icon: "gift", color: "fuchsia" },

  // --- GESTIONE EMERGENZE E FALLBACK ---
  { name: "Imprevisti", type: "variabile", icon: "alert-triangle", color: "amber" },
  { name: "Da categorizzare", type: "variabile", icon: "help-circle", color: "slate", isFallback: true },

  // --- ENTRATE ---
  { name: "Stipendio", type: "entrata", icon: "banknote", color: "emerald" },
  { name: "Freelance", type: "entrata", icon: "briefcase", color: "blue" },
  { name: "Dividendi e interessi", type: "entrata", icon: "trending-up", color: "teal" },
];
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm test lib/db/schema/categories.test.ts`
Expected: PASS (4 test verdi)

- [ ] **Step 5: Aggiorna l'UI di gestione categorie per l'opzione "Entrata"**

In `components/domain/categories/add-category-form.tsx`, sostituisci righe 11-14, 24, 66-73:

```typescript
const TYPE_LABELS: Record<"fissa" | "variabile" | "entrata", string> = {
  fissa: "Fissa",
  variabile: "Variabile",
  entrata: "Entrata",
};
```

```typescript
  const [type, setType] = React.useState<"fissa" | "variabile" | "entrata">("variabile");
```

```typescript
        <Select value={type} onValueChange={(value) => value && setType(value as "fissa" | "variabile" | "entrata")}>
          <SelectTrigger className="w-32">
            <SelectValue>{(value: "fissa" | "variabile" | "entrata") => TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fissa">Fissa</SelectItem>
            <SelectItem value="variabile">Variabile</SelectItem>
            <SelectItem value="entrata">Entrata</SelectItem>
          </SelectContent>
        </Select>
```

In `components/domain/categories/category-row.tsx`, sostituisci righe 31-34, 65-67, 103-113:

```typescript
const TYPE_LABELS: Record<"fissa" | "variabile" | "entrata", string> = {
  fissa: "Fissa",
  variabile: "Variabile",
  entrata: "Entrata",
};
```

```typescript
  function commitType(type: string | null) {
    if (type === null || type === category.type) return;
    updateMutation.mutate({ id: category.id, input: { type: type as "fissa" | "variabile" | "entrata" } });
  }
```

```typescript
          <Select value={category.type} onValueChange={commitType}>
            <SelectTrigger size="sm" className="h-6 w-fit text-xs">
              <SelectValue>
                {(value: "fissa" | "variabile" | "entrata") => TYPE_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fissa">Fissa</SelectItem>
              <SelectItem value="variabile">Variabile</SelectItem>
              <SelectItem value="entrata">Entrata</SelectItem>
            </SelectContent>
          </Select>
```

- [ ] **Step 6: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema/categories.ts lib/db/schema/categories.test.ts lib/validation/categories.ts components/domain/categories/add-category-form.tsx components/domain/categories/category-row.tsx
git commit -m "feat: aggiungi categorie di tipo entrata (schema, validazione, UI)"
```

- [ ] **Step 8: CHECKPOINT MANUALE — richiedi all'utente `pnpm db:push`**

Il nuovo valore enum `"entrata"` deve essere applicato al Postgres reale. Per convenzione di questo progetto, **non eseguire `pnpm db:push` autonomamente**: fermati qui e chiedi esplicitamente all'utente di eseguirlo dalla root del repository/worktree corrente, poi conferma che è stato fatto prima di procedere al Task 2. Senza questo passaggio, qualunque route API dei task successivi che inserisce una categoria `type: "entrata"` fallirà contro il DB reale (constraint enum non aggiornato).

---

### Task 2: Motore di calcolo Spese — direzione transazione

**Files:**
- Modify: `lib/calc/expenses.ts`
- Modify: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consuma: `Transaction` (`lib/db/schema/transactions.ts`).
- Produce: `isIncome(transaction): boolean`; `type TransactionDirection = "tutte" | "uscita" | "entrata"`; `filterByTransactionType(transactions, direction): Transaction[]`; `startOfMonth`/`endOfMonth`/`addMonths` ora esportate (usate da `lib/calc/cashflow.ts` nel Task 8). `computeCategoryBreakdown` esclude ora le categorie `type === "entrata"` dal risultato (il suo tipo di ritorno `CategoryAmount["type"]` resta `"fissa" | "variabile"`, invariato).

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi a `lib/calc/expenses.test.ts` (nell'import in cima al file, aggiungi `isIncome`, `filterByTransactionType` alla lista già importata da `./expenses`), poi aggiungi questi blocchi `describe` in fondo al file:

```typescript
describe("isIncome", () => {
  it("è true per un importo positivo", () => {
    expect(isIncome(makeTransaction({ amount: "1500.00" }))).toBe(true);
  });

  it("è false per un importo negativo o zero", () => {
    expect(isIncome(makeTransaction({ amount: "-10.00" }))).toBe(false);
    expect(isIncome(makeTransaction({ amount: "0.00" }))).toBe(false);
  });
});

describe("filterByTransactionType", () => {
  const income = makeTransaction({ id: "t-income", amount: "1500.00" });
  const expense = makeTransaction({ id: "t-expense", amount: "-30.00" });
  const all = [income, expense];

  it("'tutte' non filtra nulla", () => {
    expect(filterByTransactionType(all, "tutte")).toEqual(all);
  });

  it("'uscita' tiene solo gli importi negativi", () => {
    expect(filterByTransactionType(all, "uscita")).toEqual([expense]);
  });

  it("'entrata' tiene solo gli importi positivi", () => {
    expect(filterByTransactionType(all, "entrata")).toEqual([income]);
  });
});

describe("computeCategoryBreakdown esclude le categorie di entrata", () => {
  it("non include una categoria type 'entrata' nel risultato", () => {
    const variabile = makeCategory({ id: "cat-var", type: "variabile" });
    const entrata = makeCategory({ id: "cat-income", name: "Stipendio", type: "entrata" });
    const transactions = [
      makeTransaction({ categoryId: "cat-var", amount: "-50.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-income", amount: "1500.00", date: "2026-02-01" }),
    ];
    const referenceDate = new Date(2026, 1, 10);
    const today = referenceDate;

    const breakdown = computeCategoryBreakdown(transactions, [variabile, entrata], "mese", referenceDate, today);

    expect(breakdown.map((entry) => entry.categoryId)).toEqual(["cat-var"]);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: FAIL — `isIncome`/`filterByTransactionType` non esistono ancora; `computeCategoryBreakdown` include ancora la categoria entrata (amount 0, ma presente nel risultato).

- [ ] **Step 3: Implementa**

In `lib/calc/expenses.ts`, rendi pubbliche le tre funzioni di data-math già esistenti (righe 26-46): aggiungi `export` davanti a ciascuna:

```typescript
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
```

(lascia `startOfISOWeek`/`addDays` privati, non servono a `cashflow.ts`)

```typescript
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}
```

Subito dopo `isExpense` (dopo la riga 149), aggiungi:

```typescript
/** Transazione di entrata reale: importo positivo. */
export function isIncome(transaction: Transaction): boolean {
  return Number(transaction.amount) > 0;
}

/** Direzione per il filtro tipo-lista della schermata Transazioni. */
export type TransactionDirection = "tutte" | "uscita" | "entrata";

/** Filtra per direzione (entrata/uscita), o non filtra affatto ("tutte"). */
export function filterByTransactionType(
  transactions: Transaction[],
  direction: TransactionDirection
): Transaction[] {
  switch (direction) {
    case "tutte":
      return transactions;
    case "uscita":
      return transactions.filter(isExpense);
    case "entrata":
      return transactions.filter(isIncome);
  }
}
```

In `computeCategoryBreakdown` (riga 246-273), aggiungi il filtro subito dopo la firma, prima del `return`:

```typescript
export function computeCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): CategoryAmount[] {
  const range = getPeriodRange(period, referenceDate);
  const todayStart = startOfDay(today);
  const clampedToday = todayStart.getTime() < range.from.getTime() ? range.from : todayStart;
  const elapsedRange: DateRange = {
    from: range.from,
    to: clampedToday.getTime() < range.to.getTime() ? clampedToday : range.to,
  };

  return categories
    .filter((category) => category.type !== "entrata")
    .map((category) => {
      const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
      const { speseEffettive } = computeSummary(categoryTransactions, elapsedRange);
      return {
        categoryId: category.id,
        name: category.name,
        type: category.type,
        amount: speseEffettive,
        color: category.color,
        icon: category.icon,
      };
    });
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiungi isIncome/filterByTransactionType, escludi entrate dal breakdown categorie"
```

---

### Task 3: API transazioni — filtro tipo + segno derivato dalla categoria

**Files:**
- Modify: `app/api/transactions/route.ts`
- Modify: `app/api/transactions/route.test.ts`
- Modify: `app/api/transactions/[id]/route.ts`
- Modify: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consuma: `categories.type` (Task 1).
- Produce: `GET /api/transactions?type=uscita|entrata|tutte` (default `uscita`, retrocompatibile); `POST`/`PATCH` derivano il segno salvato dal `type` della categoria coinvolta invece di negare sempre l'importo.

- [ ] **Step 1: Scrivi i test falliti per GET/POST**

Aggiungi a `app/api/transactions/route.test.ts`, dentro il `describe` esistente, dopo il test `"crea una spesa manuale..."` (dopo la riga 140):

```typescript
  it("crea un'entrata con importo positivo quando la categoria è di tipo entrata", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();

    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: manualAccountId,
          description: "Stipendio di febbraio",
          categoryId: incomeCategory.id,
          amount: 1800,
          date: "2026-02-27",
        }),
      })
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.amount).toBe("1800.00");
  });

  it("GET con type=entrata ritorna solo le entrate", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    await db.insert(transactions).values([
      { userId, accountId: manualAccountId, categoryId, description: "Spesa", amount: "-20.00", date: "2026-02-05", source: "manuale" },
      { userId, accountId: manualAccountId, categoryId: incomeCategory.id, description: "Stipendio", amount: "1800.00", date: "2026-02-27", source: "manuale" },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=entrata")
    );
    const list = await response.json();
    expect(list).toHaveLength(1);
    expect(list[0].description).toBe("Stipendio");
  });

  it("GET con type=tutte ritorna sia entrate che uscite", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    await db.insert(transactions).values([
      { userId, accountId: manualAccountId, categoryId, description: "Spesa", amount: "-20.00", date: "2026-02-05", source: "manuale" },
      { userId, accountId: manualAccountId, categoryId: incomeCategory.id, description: "Stipendio", amount: "1800.00", date: "2026-02-27", source: "manuale" },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=tutte")
    );
    const list = await response.json();
    expect(list).toHaveLength(2);
  });

  it("risponde 400 se type non è uno dei valori validi", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=boh")
    );
    expect(response.status).toBe(400);
  });
```

- [ ] **Step 2: Scrivi i test falliti per PATCH**

Aggiungi a `app/api/transactions/[id]/route.test.ts` due nuove variabili nel `describe` (dopo `otherUserCategoryId`, riga 25) e popolale nel `beforeEach` (dopo `otherUserCategory`, riga 78):

```typescript
  let incomeCategoryId: string;
  let fallbackCategoryId: string;
```

```typescript
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    incomeCategoryId = incomeCategory.id;

    const [fallbackCategory] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "variabile", isFallback: true })
      .returning();
    fallbackCategoryId = fallbackCategory.id;
```

Poi aggiungi questi test, dopo il test `"risponde 400 se categoryId appartiene a un altro utente"` (dopo la riga 279):

```typescript
  it("risponde 400 se si cambia categoria con una di direzione incompatibile (entrata su una spesa)", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId, description: "Spesa", amount: "-50.00", date: "2026-02-10", source: "manuale" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: incomeCategoryId }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(400);
  });

  it("permette di riassegnare a 'Da categorizzare' anche con direzione diversa (guard bypassata per la fallback)", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId, description: "Spesa", amount: "-50.00", date: "2026-02-10", source: "manuale" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: fallbackCategoryId }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.categoryId).toBe(fallbackCategoryId);
    expect(updated.amount).toBe("-50.00");
  });

  it("deriva il segno dal tipo della nuova categoria quando categoria e importo cambiano insieme", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId, description: "Da correggere", amount: "-50.00", date: "2026-02-10", source: "manuale" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: incomeCategoryId, amount: 50 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.categoryId).toBe(incomeCategoryId);
    expect(updated.amount).toBe("50.00");
  });

  it("preserva la direzione entrata quando si modifica solo l'importo", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: incomeCategoryId, description: "Stipendio", amount: "1500.00", date: "2026-02-27", source: "manuale" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ amount: 1600 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.amount).toBe("1600.00");
  });
```

- [ ] **Step 3: Esegui i test e verifica che falliscano**

Run: `pnpm test app/api/transactions`
Expected: FAIL su tutti i nuovi test (GET ignora `type`, POST nega sempre l'importo, PATCH non applica alcun guard).

- [ ] **Step 4: Implementa GET/POST**

Sostituisci `app/api/transactions/route.ts` interamente:

```typescript
import { NextRequest } from "next/server";
import { and, desc, eq, gt, gte, lt, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { createTransactionSchema } from "@/lib/validation/transactions";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = ["uscita", "entrata", "tutte"] as const;
type TypeParam = (typeof VALID_TYPES)[number];

/** GET /api/transactions?from&to&type — ritorna le transazioni dell'utente autenticato nel periodo indicato, filtrate per direzione (default "uscita", retrocompatibile). */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return Response.json({ error: "from e to sono obbligatori (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!DATE_FORMAT.test(from) || !DATE_FORMAT.test(to)) {
    return Response.json({ error: "from e to devono avere formato YYYY-MM-DD" }, { status: 400 });
  }

  const typeParam = (url.searchParams.get("type") ?? "uscita") as TypeParam;
  if (!VALID_TYPES.includes(typeParam)) {
    return Response.json({ error: "type deve essere uno tra uscita, entrata, tutte" }, { status: 400 });
  }

  const directionCondition =
    typeParam === "uscita" ? lt(transactions.amount, "0") : typeParam === "entrata" ? gt(transactions.amount, "0") : undefined;

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        gte(transactions.date, from),
        lte(transactions.date, to),
        ...(directionCondition ? [directionCondition] : [])
      )
    )
    .orderBy(desc(transactions.date));

  return Response.json(rows);
}

/** POST /api/transactions — crea una transazione manuale; il segno salvato è derivato dal type della categoria scelta (entrata → positivo, fissa/variabile → negato). */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, parsed.data.accountId), eq(accounts.userId, session.user.id)));
  if (!account) {
    return Response.json({ error: "Conto non valido" }, { status: 400 });
  }
  if (account.source === "auto") {
    return Response.json(
      { error: "Non è possibile aggiungere una spesa manuale a un conto collegato automaticamente" },
      { status: 400 }
    );
  }

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, session.user.id)));
  if (!category) {
    return Response.json({ error: "Categoria non valida" }, { status: 400 });
  }

  const signedAmount = category.type === "entrata" ? parsed.data.amount : -parsed.data.amount;

  const [transaction] = await db
    .insert(transactions)
    .values({
      userId: session.user.id,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      amount: signedAmount.toFixed(2),
      date: parsed.data.date,
      source: "manuale",
    })
    .returning();

  return Response.json(transaction, { status: 201 });
}
```

- [ ] **Step 5: Implementa PATCH**

In `app/api/transactions/[id]/route.ts`, sostituisci il blocco righe 53-67 (dalla validazione di `categoryId` fino al calcolo di `newAmount`/`newExcludedAmount` incluso — non toccare il blocco successivo di rivalidazione `isValidExcludedAmount`, che resta invariato subito dopo):

```typescript
  let resolvedCategory: typeof categories.$inferSelect | null = null;
  if (parsed.data.categoryId !== undefined) {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, session.user.id)));
    if (!category) {
      return Response.json({ error: "Categoria non valida" }, { status: 400 });
    }
    resolvedCategory = category;
  }

  const currentIsIncome = Number(transaction.amount) > 0;

  // Se si cambia categoria senza toccare l'importo, la nuova categoria deve avere una direzione
  // compatibile con il segno già salvato (a meno che sia la categoria fallback, che non ha una
  // direzione propria e può accogliere transazioni di entrambi i segni).
  if (resolvedCategory && parsed.data.amount === undefined && !resolvedCategory.isFallback) {
    const newCategoryIsIncome = resolvedCategory.type === "entrata";
    if (newCategoryIsIncome !== currentIsIncome) {
      return Response.json(
        { error: "La categoria scelta non è compatibile con la direzione della transazione" },
        { status: 400 }
      );
    }
  }

  // Direzione da usare per il segno del nuovo importo: quella della categoria appena assegnata
  // (se non fallback), altrimenti quella già in vigore sulla transazione.
  const signIsIncome =
    resolvedCategory && !resolvedCategory.isFallback ? resolvedCategory.type === "entrata" : currentIsIncome;

  const newAmount =
    parsed.data.amount !== undefined
      ? signIsIncome
        ? parsed.data.amount
        : -parsed.data.amount
      : Number(transaction.amount);
  let newExcludedAmount: number | undefined;
  if (parsed.data.excludedAmount !== undefined) {
    newExcludedAmount = -Math.abs(parsed.data.excludedAmount);
  }
```

Il resto del file (validazione `isValidExcludedAmount` e l'`update` finale) resta invariato.

- [ ] **Step 6: Esegui i test e verifica che passino**

Run: `pnpm test app/api/transactions`
Expected: PASS (tutti i test esistenti + i nuovi)

- [ ] **Step 7: Commit**

```bash
git add app/api/transactions
git commit -m "feat: API transazioni supportano entrate (filtro type, segno derivato dalla categoria)"
```

---

### Task 4: Hook query transazioni — parametro tipo

**Files:**
- Modify: `lib/queries/transactions.ts`

**Interfaces:**
- Consuma: `GET /api/transactions?type=` (Task 3).
- Produce: `useTransactionsQuery(from, to, type: "uscita" | "entrata" | "tutte" = "uscita")` — i chiamanti esistenti (Spese) continuano a funzionare senza modifiche se non passano il terzo argomento.

- [ ] **Step 1: Implementa**

In `lib/queries/transactions.ts`, sostituisci righe 8-23:

```typescript
export type TransactionDirectionParam = "uscita" | "entrata" | "tutte";

function transactionsQueryKey(from: string, to: string, type: TransactionDirectionParam) {
  return ["transactions", from, to, type] as const;
}

async function fetchTransactions(from: string, to: string, type: TransactionDirectionParam): Promise<Transaction[]> {
  const response = await fetch(`/api/transactions?from=${from}&to=${to}&type=${type}`);
  if (!response.ok) {
    throw new Error("Impossibile caricare le transazioni");
  }
  return response.json();
}

/** Recupera le transazioni dell'utente nell'intervallo [from, to] (YYYY-MM-DD), filtrate per direzione (default "uscita"). */
export function useTransactionsQuery(from: string, to: string, type: TransactionDirectionParam = "uscita") {
  return useQuery({ queryKey: transactionsQueryKey(from, to, type), queryFn: () => fetchTransactions(from, to, type) });
}
```

- [ ] **Step 2: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore (la firma con default mantiene compatibili tutte le chiamate esistenti a un solo/due argomenti).

- [ ] **Step 3: Commit**

```bash
git add lib/queries/transactions.ts
git commit -m "feat: useTransactionsQuery accetta un parametro di direzione"
```

---

### Task 5: Form "Aggiungi transazione" — toggle Spesa/Entrata

**Files:**
- Modify: `components/domain/expenses/add-transaction-form.tsx`

**Interfaces:**
- Consuma: `Category["type"]` (Task 1).
- Produce: nessuna nuova prop pubblica — `AddTransactionFormProps` invariata (riceve ancora tutte le categorie, filtra internamente).

- [ ] **Step 1: Implementa**

In `components/domain/expenses/add-transaction-form.tsx`, aggiungi lo stato di direzione e il filtro categorie. Sostituisci righe 29-46:

```typescript
  const [accountIdOverride, setAccountIdOverride] = React.useState<string | null>(null);
  const [direction, setDirection] = React.useState<"spesa" | "entrata">("spesa");
  const [description, setDescription] = React.useState("");
  const [categoryIdOverride, setCategoryIdOverride] = React.useState<string | null>(null);
  const [amountValue, setAmountValue] = React.useState<number | null>(null);
  const [date, setDate] = React.useState(todayDateString());
  const [error, setError] = React.useState<string | null>(null);

  const availableCategories = categories.filter((c) => (direction === "entrata" ? c.type === "entrata" : c.type !== "entrata"));

  function handleDirectionChange(next: "spesa" | "entrata") {
    setDirection(next);
    setCategoryIdOverride(null);
  }

  // Preseleziona il primo conto/categoria disponibile finché l'utente non sceglie esplicitamente.
  const accountId = accountIdOverride ?? manualAccounts[0]?.id ?? "";
  const categoryId = categoryIdOverride ?? availableCategories[0]?.id ?? "";

  const canSubmit =
    accountId !== "" &&
    description.trim() !== "" &&
    categoryId !== "" &&
    amountValue !== null &&
    amountValue > 0 &&
    date !== "";
```

Aggiungi il toggle nel form JSX, subito prima del blocco "Conto" (prima della riga con `<div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">` che contiene "Conto"):

```typescript
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Tipo</label>
        <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
          {(["spesa", "entrata"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleDirectionChange(option)}
              aria-pressed={direction === option}
              className={
                direction === option
                  ? "rounded-md bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {option === "spesa" ? "Spesa" : "Entrata"}
            </button>
          ))}
        </div>
      </div>
```

E sostituisci il blocco select "Categoria" (righe 117-140) per usare `availableCategories` invece di `categories`:

```typescript
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Categoria</label>
        <Select
          value={categoryId}
          onValueChange={(value) => {
            if (value === null) return;
            setCategoryIdOverride(value);
          }}
          disabled={availableCategories.length === 0}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Categoria">
              {(value: string | null) => availableCategories.find((c) => c.id === value)?.name ?? ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
```

E aggiorna il messaggio di avviso "Nessuna categoria disponibile" (riga 178-182) per usare `availableCategories`:

```typescript
      {availableCategories.length === 0 && (
        <p className="w-full text-sm text-muted-foreground">
          {direction === "entrata"
            ? "Nessuna categoria di entrata disponibile: aggiungine una dalla pagina Categorie."
            : "Nessuna categoria disponibile: aggiungine una prima di registrare una spesa."}
        </p>
      )}
```

Infine, resetta anche `direction` a `"spesa"` nell'`onSuccess` della mutation (dentro `handleSubmit`, accanto a `setDescription("")`/`setAmountValue(null)`):

```typescript
        onSuccess: () => {
          setDescription("");
          setAmountValue(null);
          setDate(todayDateString());
          setDirection("spesa");
        },
```

- [ ] **Step 2: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/add-transaction-form.tsx
git commit -m "feat: form Aggiungi transazione supporta la creazione di entrate"
```

---

### Task 6: Riga transazione — categoria filtrata per direzione, niente "Dividi" sulle entrate

**Files:**
- Modify: `components/domain/expenses/transaction-row.tsx`

**Interfaces:**
- Consuma: `Category["type"]`, `isIncome`-equivalente inline (stesso criterio `amount > 0`).
- Produce: nessuna nuova prop pubblica.

- [ ] **Step 1: Implementa**

In `components/domain/expenses/transaction-row.tsx`, sostituisci righe 46-55:

```typescript
  const excludedAmount = Math.abs(Number(transaction.excludedAmount));
  const fullAmount = Math.abs(Number(transaction.amount));
  const netAmount = fullAmount - excludedAmount;
  const isSplit = excludedAmount > 0;
  const isIncome = Number(transaction.amount) > 0;
  const currentCategory = categories.find((c) => c.id === transaction.categoryId);
  const isUncategorized = currentCategory?.isFallback ?? false;
  const sortedCategories = React.useMemo(
    () =>
      categories
        .filter((c) => c.isFallback || (isIncome ? c.type === "entrata" : c.type !== "entrata"))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, isIncome]
  );
```

E nascondi il bottone "Dividi" per le transazioni di entrata: sostituisci righe 220-227:

```typescript
          {!isIncome && (
            <button
              type="button"
              onClick={() => setSplitOpen((open) => !open)}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              aria-pressed={splitOpen}
            >
              Dividi
            </button>
          )}
```

E la resa condizionale di `SplitSlider` in fondo (righe 259-261) resta invariata (già condizionata da `splitOpen`, che ora non può più diventare `true` per una riga di entrata dato che il bottone che lo attiva è nascosto).

- [ ] **Step 2: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/transaction-row.tsx
git commit -m "feat: riga transazione filtra la categoria per direzione e nasconde Dividi sulle entrate"
```

---

### Task 7: Toggle tipo lista + pagina Transazioni (rebrand di Spese)

**Files:**
- Create: `components/domain/expenses/transactions-type-toggle.tsx`
- Modify: `components/domain/expenses/index.ts`
- Modify: `app/(app)/spese/page.tsx`
- Modify: `components/layout/sidebar.tsx`

**Interfaces:**
- Consuma: `TransactionDirection`, `filterByTransactionType`, `isExpense` (Task 2); `useTransactionsQuery(from, to, "tutte")` (Task 4).
- Produce: `TransactionsTypeToggle` esportato dal barrel `components/domain/expenses`.

- [ ] **Step 1: Crea il toggle**

Crea `components/domain/expenses/transactions-type-toggle.tsx`:

```typescript
"use client";

/** Toggle Tutte/Uscite/Entrate per la lista transazioni (non influenza KPI/donut/trend, sempre uscite-only). */

import { cn } from "@/lib/utils";
import type { TransactionDirection } from "@/lib/calc/expenses";

const OPTIONS: { value: TransactionDirection; label: string }[] = [
  { value: "tutte", label: "Tutte" },
  { value: "uscita", label: "Uscite" },
  { value: "entrata", label: "Entrate" },
];

export interface TransactionsTypeToggleProps {
  value: TransactionDirection;
  onChange: (direction: TransactionDirection) => void;
}

export function TransactionsTypeToggle({ value, onChange }: TransactionsTypeToggleProps) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

Aggiungi al barrel `components/domain/expenses/index.ts` (dopo l'export di `AutoCategorizeWizard`):

```typescript
export { TransactionsTypeToggle } from "./transactions-type-toggle";
export type { TransactionsTypeToggleProps } from "./transactions-type-toggle";
```

- [ ] **Step 2: Rinomina la voce di navigazione**

In `components/layout/sidebar.tsx`, riga 70, cambia:

```typescript
  { label: "Transazioni", href: "/spese", icon: ShoppingCart },
```

- [ ] **Step 3: Wire della pagina**

In `app/(app)/spese/page.tsx`, sostituisci l'intero file:

```typescript
"use client";

/** Pagina Transazioni (ex Spese): orchestra periodo, KPI, grafici, categorie/budget, lista transazioni e form di aggiunta. */

import * as React from "react";
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
  TransactionsTypeToggle,
} from "@/components/domain/expenses";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import {
  computeCategoryBreakdown,
  computeCategoryMonthlyStacks,
  computeFixedVsVariable,
  computeSummary,
  filterByTransactionType,
  filterTransactions,
  getPeriodRange,
  isExpense,
  type ExpensePeriod,
  type TransactionDirection,
} from "@/lib/calc/expenses";
import { formatCurrency } from "@/lib/format";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Finestra di fetch: dal 1° gennaio dell'anno precedente al 31 dicembre corrente — copre "anno", il confronto col periodo precedente e l'andamento 6 mesi. */
function fetchWindow(referenceDate: Date): { from: string; to: string } {
  const from = new Date(referenceDate.getFullYear() - 1, 0, 1);
  const to = new Date(referenceDate.getFullYear(), 11, 31);
  return { from: toDateString(from), to: toDateString(to) };
}

export default function SpesePage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const today = React.useMemo(() => new Date(), []);
  const [period, setPeriod] = React.useState<ExpensePeriod>("mese");
  const [showUncategorizedOnly, setShowUncategorizedOnly] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState("");
  const [listTypeFilter, setListTypeFilter] = React.useState<TransactionDirection>("uscita");

  const { from, to } = fetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const { data: categories } = useCategoriesQuery();
  const { data: budgets } = useBudgetsQuery();

  const safeTransactions = transactions ?? [];
  const safeCategories = categories ?? [];
  const safeBudgets = budgets ?? [];

  const filteredTransactions = filterTransactions(safeTransactions, {
    categoryId: categoryFilter,
    searchText,
  });

  // Widget di analisi (KPI/donut/trend): sempre e solo uscite, indipendentemente dal toggle tipo-lista.
  const expenseTransactionsForAnalysis = filteredTransactions.filter(isExpense);
  const filteredBudgets = categoryFilter
    ? safeBudgets.filter((b) => b.categoryId === categoryFilter)
    : safeBudgets;

  // Lista: rispetta il toggle Tutte/Uscite/Entrate.
  const listFiltered = filterByTransactionType(filteredTransactions, listTypeFilter);

  const fallbackCategoryIds = new Set(
    safeCategories.filter((c) => c.isFallback).map((c) => c.id)
  );

  const range = getPeriodRange(period, referenceDate);
  const transactionsInPeriodAll = listFiltered.filter(
    (t) => t.date >= toDateString(range.from) && t.date <= toDateString(range.to)
  );
  const uncategorizedCount = transactionsInPeriodAll.filter(
    (t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId)
  ).length;
  const transactionsInPeriod = showUncategorizedOnly
    ? transactionsInPeriodAll.filter((t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId))
    : transactionsInPeriodAll;

  const hasActiveFilter = categoryFilter !== null || searchText.trim() !== "";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Transazioni</h1>
          <ExpensesReferenceNav period={period} referenceDate={referenceDate} onChange={setReferenceDate} />
        </div>
        <a
          href="/categorie"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Gestisci categorie
        </a>
        <AutoCategorizeButton categories={safeCategories} currency={currency} />
        {uncategorizedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowUncategorizedOnly((v) => !v)}
            aria-pressed={showUncategorizedOnly}
            className={
              showUncategorizedOnly
                ? "flex items-center gap-1.5 rounded-full border border-neg/40 bg-neg-soft px-3 py-1 text-sm font-medium text-neg"
                : "flex items-center gap-1.5 rounded-full border border-neg/40 px-3 py-1 text-sm font-medium text-neg hover:bg-neg-soft/50"
            }
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-neg opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-neg" />
            </span>
            Da categorizzare ({uncategorizedCount})
          </button>
        )}
        <ExpensesPeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ExpensesFilterBar
          categories={safeCategories}
          categoryId={categoryFilter}
          onCategoryChange={(categoryId) => {
            setCategoryFilter(categoryId);
            setShowUncategorizedOnly(false);
          }}
          searchText={searchText}
          onSearchTextChange={setSearchText}
        />
        <TransactionsTypeToggle value={listTypeFilter} onChange={setListTypeFilter} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare le transazioni.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <>
          <ExpensesKpiCards
            transactions={expenseTransactionsForAnalysis}
            budgets={filteredBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
            today={today}
          />

          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(expenseTransactionsForAnalysis, safeCategories, period, referenceDate, today)}
            fixedVsVariable={computeFixedVsVariable(expenseTransactionsForAnalysis, safeCategories, period, referenceDate, today)}
            budgets={safeBudgets}
            currency={currency}
          />

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground">
              {(() => {
                const summary = computeSummary(expenseTransactionsForAnalysis, range);
                return (
                  <>
                    <span>Uscite: {formatCurrency(summary.uscite, currency)}</span>
                    <span>Escluse: {formatCurrency(summary.escluse, currency)}</span>
                    <span className="font-medium text-foreground">
                      Spese effettive: {formatCurrency(summary.speseEffettive, currency)}
                    </span>
                  </>
                );
              })()}
            </div>
            {transactionsInPeriod.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {showUncategorizedOnly
                  ? "Nessuna transazione da categorizzare in questo periodo."
                  : hasActiveFilter
                    ? "Nessuna transazione corrisponde ai filtri applicati in questo periodo."
                    : "Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto."}
              </p>
            ) : (
              transactionsInPeriod.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categories={safeCategories}
                  currency={currency}
                />
              ))
            )}
            <AddTransactionForm categories={safeCategories} currency={currency} />
          </Card>

          <ExpenseTrendChart
            monthlyStacks={computeCategoryMonthlyStacks(expenseTransactionsForAnalysis, safeCategories, referenceDate)}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/transactions-type-toggle.tsx components/domain/expenses/index.ts app/\(app\)/spese/page.tsx components/layout/sidebar.tsx
git commit -m "feat: rinomina Spese in Transazioni, aggiungi toggle tipo lista"
```

---

### Task 8: Motore di calcolo Cash flow

**Files:**
- Create: `lib/calc/cashflow.ts`
- Create: `lib/calc/cashflow.test.ts`

**Interfaces:**
- Consuma: `Transaction`, `Category` (schema); `isExpense`, `isIncome`, `MONTH_LABELS`, `parseDateOnly`, `startOfDay`, `startOfMonth`, `endOfMonth`, `addMonths`, `type DateRange` da `lib/calc/expenses.ts` (Task 2).
- Produce: `type CashflowPeriod`; `getCashflowPeriodRange`; `getPreviousCashflowPeriodRange`; `shiftCashflowReferenceDate`; `formatCashflowPeriodLabel`; `computeCashflowKpis`; `computeMonthlySeries`; `computeIncomeSources`; `computeWhereItGoes`; `computeAccumulatedSavings` — tutte usate dai Task 9-11.

- [ ] **Step 1: Scrivi il test**

Crea `lib/calc/cashflow.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeAccumulatedSavings,
  computeCashflowKpis,
  computeIncomeSources,
  computeMonthlySeries,
  computeWhereItGoes,
  formatCashflowPeriodLabel,
  getCashflowPeriodRange,
  getPreviousCashflowPeriodRange,
  shiftCashflowReferenceDate,
} from "./cashflow";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Transazione",
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-02-10",
    source: "manuale",
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "category-1",
    userId: "user-1",
    name: "Categoria",
    type: "variabile",
    color: "slate",
    icon: "package",
    isFallback: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("getCashflowPeriodRange", () => {
  it("'3mesi' copre il mese di riferimento e i 2 precedenti", () => {
    const range = getCashflowPeriodRange("3mesi", new Date(2026, 2, 15)); // 15 marzo 2026
    expect(range.from).toEqual(new Date(2026, 0, 1)); // 1 gennaio
    expect(range.to).toEqual(new Date(2026, 2, 31)); // 31 marzo
  });

  it("'12mesi' copre 12 mesi calendariali fino al mese di riferimento incluso", () => {
    const range = getCashflowPeriodRange("12mesi", new Date(2026, 2, 15));
    expect(range.from).toEqual(new Date(2025, 3, 1)); // aprile 2025
    expect(range.to).toEqual(new Date(2026, 2, 31));
  });
});

describe("getPreviousCashflowPeriodRange / shiftCashflowReferenceDate", () => {
  it("il periodo precedente di '3mesi' è spostato indietro di 3 mesi", () => {
    const previous = getPreviousCashflowPeriodRange("3mesi", new Date(2026, 2, 15));
    expect(previous.from).toEqual(new Date(2025, 9, 1)); // ottobre 2025
    expect(previous.to).toEqual(new Date(2025, 11, 31)); // 31 dicembre 2025
  });

  it("shiftCashflowReferenceDate avanti di '6mesi' sposta di 6 mesi", () => {
    const shifted = shiftCashflowReferenceDate("6mesi", new Date(2026, 2, 15), 1);
    expect(shifted).toEqual(new Date(2026, 8, 15));
  });
});

describe("formatCashflowPeriodLabel", () => {
  it("formatta un range nello stesso anno come 'Mmm – Mmm AAAA'", () => {
    const range = getCashflowPeriodRange("3mesi", new Date(2026, 2, 15));
    expect(formatCashflowPeriodLabel(range)).toBe("Gen – Mar 2026");
  });
});

describe("computeCashflowKpis", () => {
  const range = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 28) }; // gen-feb 2026

  it("calcola entrate/uscite medie, flusso netto e tasso di risparmio", () => {
    const transactions = [
      makeTransaction({ amount: "1500.00", date: "2026-01-05" }),
      makeTransaction({ amount: "-500.00", date: "2026-01-10" }),
      makeTransaction({ amount: "1500.00", date: "2026-02-05" }),
      makeTransaction({ amount: "-700.00", date: "2026-02-10" }),
    ];

    const kpis = computeCashflowKpis(transactions, range);

    expect(kpis.entrateMedie).toBe(1500);
    expect(kpis.usciteMedie).toBe(600);
    expect(kpis.flussoNetto).toBe(1800);
    expect(kpis.tassoRisparmio).toBeCloseTo(1800 / 3000);
  });

  it("tassoRisparmio è null quando le entrate sono zero", () => {
    const transactions = [makeTransaction({ amount: "-500.00", date: "2026-01-10" })];
    const kpis = computeCashflowKpis(transactions, range);
    expect(kpis.tassoRisparmio).toBeNull();
  });
});

describe("computeMonthlySeries", () => {
  it("include un mese senza transazioni con entrate/uscite a 0", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 28) };
    const transactions = [makeTransaction({ amount: "1000.00", date: "2026-01-05" })];

    const series = computeMonthlySeries(transactions, range);

    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ month: 0, entrate: 1000, uscite: 0 });
    expect(series[1]).toMatchObject({ month: 1, entrate: 0, uscite: 0 });
  });
});

describe("computeIncomeSources", () => {
  it("ordina le fonti per importo decrescente con quota % sul totale", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const freelance = makeCategory({ id: "cat-freelance", name: "Freelance", type: "entrata" });
    const transactions = [
      makeTransaction({ categoryId: "cat-stipendio", amount: "1500.00", date: "2026-01-05" }),
      makeTransaction({ categoryId: "cat-freelance", amount: "500.00", date: "2026-01-10" }),
    ];

    const sources = computeIncomeSources(transactions, [stipendio, freelance], range);

    expect(sources.map((s) => s.categoryId)).toEqual(["cat-stipendio", "cat-freelance"]);
    expect(sources[0].quotaPct).toBeCloseTo(75);
    expect(sources[1].quotaPct).toBeCloseTo(25);
  });

  it("esclude una fonte con importo zero nel periodo", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const dividendi = makeCategory({ id: "cat-dividendi", name: "Dividendi", type: "entrata" });
    const transactions = [makeTransaction({ categoryId: "cat-stipendio", amount: "1500.00", date: "2026-01-05" })];

    const sources = computeIncomeSources(transactions, [stipendio, dividendi], range);

    expect(sources.map((s) => s.categoryId)).toEqual(["cat-stipendio"]);
  });
});

describe("computeWhereItGoes", () => {
  it("calcola fisse/variabili/risparmio del mese di riferimento con quote sul totale entrate", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const variabile = makeCategory({ id: "cat-variabile", type: "variabile" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-400.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-variabile", amount: "-300.00", date: "2026-02-10" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];

    const entries = computeWhereItGoes(transactions, [fissa, variabile], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "fisse")?.amount).toBe(400);
    expect(entries.find((e) => e.key === "fisse")?.quotaPct).toBeCloseTo((400 / 1500) * 100);
    expect(entries.find((e) => e.key === "variabili")?.amount).toBe(300);
    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(800);
  });

  it("il risparmio può essere negativo se si spende più di quanto entra", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-2000.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(-500);
  });

  it("quotaPct è null quando le entrate del mese sono zero", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [makeTransaction({ categoryId: "cat-fissa", amount: "-200.00", date: "2026-02-05" })];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.every((e) => e.quotaPct === null)).toBe(true);
  });
});

describe("computeAccumulatedSavings", () => {
  it("somma cumulativamente il flusso netto mese su mese, anche quando negativo", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 2, 31) };
    const transactions = [
      makeTransaction({ amount: "1000.00", date: "2026-01-05" }),
      makeTransaction({ amount: "-1500.00", date: "2026-02-05" }),
      makeTransaction({ amount: "500.00", date: "2026-03-05" }),
    ];

    const result = computeAccumulatedSavings(transactions, range);

    expect(result.map((e) => e.cumulative)).toEqual([1000, -500, 0]);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm test lib/calc/cashflow.test.ts`
Expected: FAIL — `lib/calc/cashflow.ts` non esiste ancora.

- [ ] **Step 3: Implementa**

Crea `lib/calc/cashflow.ts`:

```typescript
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";
import {
  addMonths,
  endOfMonth,
  isExpense,
  isIncome,
  MONTH_LABELS,
  parseDateOnly,
  startOfMonth,
  type DateRange,
} from "./expenses";

/** Periodo selezionabile nella schermata Cash flow. */
export type CashflowPeriod = "3mesi" | "6mesi" | "12mesi" | "24mesi";

const PERIOD_MONTHS: Record<CashflowPeriod, number> = {
  "3mesi": 3,
  "6mesi": 6,
  "12mesi": 12,
  "24mesi": 24,
};

function isWithinRange(date: Date, range: DateRange): boolean {
  return date.getTime() >= range.from.getTime() && date.getTime() <= range.to.getTime();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthsInRange(range: DateRange): Date[] {
  const months: Date[] = [];
  let cursor = startOfMonth(range.from);
  const end = startOfMonth(range.to);
  while (cursor.getTime() <= end.getTime()) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

/** Intervallo calendariale del periodo Cash flow: `months` mesi calendariali fino a `referenceDate` incluso. */
export function getCashflowPeriodRange(period: CashflowPeriod, referenceDate: Date): DateRange {
  const months = PERIOD_MONTHS[period];
  return { from: startOfMonth(addMonths(referenceDate, -(months - 1))), to: endOfMonth(referenceDate) };
}

/** Intervallo, di uguale lunghezza, immediatamente precedente al periodo Cash flow selezionato. */
export function getPreviousCashflowPeriodRange(period: CashflowPeriod, referenceDate: Date): DateRange {
  const months = PERIOD_MONTHS[period];
  return getCashflowPeriodRange(period, addMonths(referenceDate, -months));
}

/** Sposta referenceDate di un'unità di periodo Cash flow (avanti se direction=1, indietro se direction=-1). */
export function shiftCashflowReferenceDate(period: CashflowPeriod, referenceDate: Date, direction: 1 | -1): Date {
  const months = PERIOD_MONTHS[period];
  return addMonths(referenceDate, months * direction);
}

/** Etichetta leggibile del periodo Cash flow, es. "Gen – Mar 2026" o "Gen 2025 – Dic 2026". */
export function formatCashflowPeriodLabel(range: DateRange): string {
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  const monthYearFormat = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });
  if (sameYear) {
    const monthOnly = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(range.from);
    return `${capitalize(monthOnly)} – ${capitalize(monthYearFormat.format(range.to))}`;
  }
  return `${capitalize(monthYearFormat.format(range.from))} – ${capitalize(monthYearFormat.format(range.to))}`;
}

export interface CashflowKpis {
  entrateMedie: number;
  usciteMedie: number;
  flussoNetto: number;
  /** null se le entrate nel periodo sono zero (non calcolabile). */
  tassoRisparmio: number | null;
}

/** KPI principali di Cash flow: entrate/uscite medie mensili, flusso netto, tasso di risparmio sul periodo selezionato. */
export function computeCashflowKpis(transactions: Transaction[], range: DateRange): CashflowKpis {
  const inRange = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), range));
  const entrate = inRange.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
  const uscite = inRange.filter(isExpense).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const monthCount = monthsInRange(range).length;

  const flussoNetto = entrate - uscite;
  return {
    entrateMedie: entrate / monthCount,
    usciteMedie: uscite / monthCount,
    flussoNetto,
    tassoRisparmio: entrate > 0 ? flussoNetto / entrate : null,
  };
}

export interface CashflowMonthlyEntry {
  year: number;
  month: number;
  label: string;
  entrate: number;
  uscite: number;
}

/** Serie mensile entrate/uscite per ciascun mese calendariale nel range (inclusi i mesi senza transazioni, a 0). */
export function computeMonthlySeries(transactions: Transaction[], range: DateRange): CashflowMonthlyEntry[] {
  return monthsInRange(range).map((monthDate) => {
    const monthRange: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };
    const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
    return {
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      entrate: inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0),
      uscite: inMonth.filter(isExpense).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
    };
  });
}

export interface IncomeSourceAmount {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  /** null se il totale entrate nel periodo è zero (non calcolabile). */
  quotaPct: number | null;
}

/** Entrate per categoria di tipo "entrata" nel periodo, ordinate decrescenti, con quota % sul totale entrate. Esclude le fonti a importo zero. */
export function computeIncomeSources(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange
): IncomeSourceAmount[] {
  const incomeCategories = categories.filter((c) => c.type === "entrata");
  const inRange = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), range) && isIncome(t));
  const totalEntrate = inRange.reduce((sum, t) => sum + Number(t.amount), 0);

  return incomeCategories
    .map((category) => {
      const amount = inRange
        .filter((t) => t.categoryId === category.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        amount,
        quotaPct: totalEntrate > 0 ? (amount / totalEntrate) * 100 : null,
      };
    })
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export interface WhereItGoesEntry {
  key: "fisse" | "variabili" | "risparmio";
  label: string;
  amount: number;
  /** null se le entrate del mese sono zero (non calcolabile). Il risparmio può essere negativo (nessun floor a zero). */
  quotaPct: number | null;
}

/** "Dove va ogni euro" del mese di riferimento: spese fisse, spese variabili, risparmio (entrate - fisse - variabili), con quota % sul totale entrate. */
export function computeWhereItGoes(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date
): WhereItGoesEntry[] {
  const monthRange: DateRange = { from: startOfMonth(referenceDate), to: endOfMonth(referenceDate) };
  const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
  const categoryTypeById = new Map(categories.map((c) => [c.id, c.type] as const));

  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
  const fisse = inMonth
    .filter((t) => isExpense(t) && categoryTypeById.get(t.categoryId) === "fissa")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const variabili = inMonth
    .filter((t) => isExpense(t) && categoryTypeById.get(t.categoryId) === "variabile")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const risparmio = entrate - fisse - variabili;

  const quotaOf = (amount: number) => (entrate > 0 ? (amount / entrate) * 100 : null);
  return [
    { key: "fisse", label: "Spese fisse", amount: fisse, quotaPct: quotaOf(fisse) },
    { key: "variabili", label: "Spese variabili", amount: variabili, quotaPct: quotaOf(variabili) },
    { key: "risparmio", label: "Risparmio", amount: risparmio, quotaPct: quotaOf(risparmio) },
  ];
}

export interface AccumulatedSavingsEntry {
  year: number;
  month: number;
  label: string;
  cumulative: number;
}

/** Somma cumulata mese su mese del flusso netto (entrate - uscite) lungo il range selezionato. */
export function computeAccumulatedSavings(transactions: Transaction[], range: DateRange): AccumulatedSavingsEntry[] {
  const monthly = computeMonthlySeries(transactions, range);
  let running = 0;
  return monthly.map((entry) => {
    running += entry.entrate - entry.uscite;
    return { year: entry.year, month: entry.month, label: entry.label, cumulative: running };
  });
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm test lib/calc/cashflow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calc/cashflow.ts lib/calc/cashflow.test.ts
git commit -m "feat: motore di calcolo puro per la schermata Cash flow"
```

---

### Task 9: Componenti Cash flow — header (period selector, reference nav, KPI cards)

**Files:**
- Create: `components/domain/cashflow/cashflow-period-selector.tsx`
- Create: `components/domain/cashflow/cashflow-reference-nav.tsx`
- Create: `components/domain/cashflow/cashflow-kpi-cards.tsx`
- Create: `components/domain/cashflow/index.ts`

**Interfaces:**
- Consuma: `CashflowPeriod`, `getCashflowPeriodRange`, `shiftCashflowReferenceDate`, `formatCashflowPeriodLabel`, `computeCashflowKpis` (Task 8).
- Produce: `CashflowPeriodSelector`, `CashflowReferenceNav`, `CashflowKpiCards` esportati dal barrel `components/domain/cashflow`, usati dal Task 11.

- [ ] **Step 1: Crea il selettore periodo**

Crea `components/domain/cashflow/cashflow-period-selector.tsx`:

```typescript
"use client";

/** Selettore periodo 3M/6M/12M/24M per la schermata Cash flow (stesso pattern a pillole di ExpensesPeriodSelector). */

import { cn } from "@/lib/utils";
import type { CashflowPeriod } from "@/lib/calc/cashflow";

const PERIOD_OPTIONS: { value: CashflowPeriod; label: string }[] = [
  { value: "3mesi", label: "3M" },
  { value: "6mesi", label: "6M" },
  { value: "12mesi", label: "12M" },
  { value: "24mesi", label: "24M" },
];

export interface CashflowPeriodSelectorProps {
  value: CashflowPeriod;
  onChange: (period: CashflowPeriod) => void;
}

export function CashflowPeriodSelector({ value, onChange }: CashflowPeriodSelectorProps) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Crea la navigazione periodo**

Crea `components/domain/cashflow/cashflow-reference-nav.tsx`:

```typescript
"use client";

/** Navigazione del periodo Cash flow: sole frecce prev/next (nessun salto diretto a mese/anno, a differenza di Transazioni). */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCashflowPeriodLabel,
  getCashflowPeriodRange,
  shiftCashflowReferenceDate,
  type CashflowPeriod,
} from "@/lib/calc/cashflow";
import { startOfDay } from "@/lib/calc/expenses";

export interface CashflowReferenceNavProps {
  period: CashflowPeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}

export function CashflowReferenceNav({ period, referenceDate, onChange }: CashflowReferenceNavProps) {
  const today = startOfDay(new Date());
  const range = getCashflowPeriodRange(period, referenceDate);
  const isNextDisabled = range.to.getTime() >= today.getTime();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftCashflowReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </button>

      <span className="min-w-[9rem] px-2 py-1 text-center text-sm text-muted-foreground">
        {formatCashflowPeriodLabel(range)}
      </span>

      <button
        type="button"
        onClick={() => onChange(shiftCashflowReferenceDate(period, referenceDate, 1))}
        disabled={isNextDisabled}
        aria-label="Periodo successivo"
        className={cn(
          "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
          isNextDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
        )}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Crea le KPI card**

Crea `components/domain/cashflow/cashflow-kpi-cards.tsx`:

```typescript
/** 4 KPI di Cash flow: Entrate medie, Uscite medie, Flusso netto, Tasso di risparmio. */

import { StatCard } from "@/components/domain/stat-card";
import { computeCashflowKpis, getCashflowPeriodRange, type CashflowPeriod } from "@/lib/calc/cashflow";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface CashflowKpiCardsProps {
  transactions: Transaction[];
  period: CashflowPeriod;
  currency: string;
  referenceDate: Date;
}

export function CashflowKpiCards({ transactions, period, currency, referenceDate }: CashflowKpiCardsProps) {
  const range = getCashflowPeriodRange(period, referenceDate);
  const kpis = computeCashflowKpis(transactions, range);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <StatCard label="Entrate medie" value={kpis.entrateMedie} currency={currency} />
      <StatCard label="Uscite medie" value={-kpis.usciteMedie} currency={currency} />
      <StatCard label="Flusso netto" value={kpis.flussoNetto} currency={currency} />
      <StatCard
        label="Tasso di risparmio"
        value={kpis.tassoRisparmio ?? 0}
        currency={currency}
        subtitle={
          kpis.tassoRisparmio === null
            ? "Non calcolabile (nessuna entrata nel periodo)"
            : `${Math.round(kpis.tassoRisparmio * 100)}% delle entrate`
        }
      />
    </div>
  );
}
```

Nota: `StatCard` formatta sempre `value` come valuta; per "Tasso di risparmio" il valore numerico mostrato in cifra grande è fuorviante (è una card KPI che riusa `StatCard` solo per coerenza visiva di layout — il dato leggibile è nel `subtitle`). Questo è accettato per coerenza con le altre 3 card; non introdurre una variante di `StatCard` per un singolo caso d'uso (YAGNI).

Aggiorna la firma di `computeCashflowKpis` non serve — nessuna modifica a `cashflow.ts` in questo task.

- [ ] **Step 4: Crea il barrel**

Crea `components/domain/cashflow/index.ts`:

```typescript
/**
 * components/domain/cashflow — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Cash flow.
 */

export { CashflowPeriodSelector } from "./cashflow-period-selector";
export type { CashflowPeriodSelectorProps } from "./cashflow-period-selector";
export { CashflowReferenceNav } from "./cashflow-reference-nav";
export type { CashflowReferenceNavProps } from "./cashflow-reference-nav";
export { CashflowKpiCards } from "./cashflow-kpi-cards";
export type { CashflowKpiCardsProps } from "./cashflow-kpi-cards";
```

- [ ] **Step 5: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/domain/cashflow/cashflow-period-selector.tsx components/domain/cashflow/cashflow-reference-nav.tsx components/domain/cashflow/cashflow-kpi-cards.tsx components/domain/cashflow/index.ts
git commit -m "feat: componenti header Cash flow (selettore periodo, nav, KPI)"
```

---

### Task 10: Componenti Cash flow — grafici e liste

**Files:**
- Create: `components/domain/cashflow/cashflow-trend-chart.tsx`
- Create: `components/domain/cashflow/income-sources-list.tsx`
- Create: `components/domain/cashflow/where-it-goes-breakdown.tsx`
- Create: `components/domain/cashflow/accumulated-savings-chart.tsx`
- Modify: `components/domain/cashflow/index.ts`

**Interfaces:**
- Consuma: `computeMonthlySeries`, `computeIncomeSources`, `computeWhereItGoes`, `computeAccumulatedSavings` e i relativi tipi (Task 8); `CategoryAvatar`, `ICON_MAP` (`components/domain/categories`); `SWATCH_CHART_COLOR` (`components/domain/shared/color-swatches`).
- Produce: `CashflowTrendChart`, `IncomeSourcesList`, `WhereItGoesBreakdown`, `AccumulatedSavingsChart` esportati dal barrel, usati dal Task 11.

- [ ] **Step 1: Grafico entrate vs uscite**

Crea `components/domain/cashflow/cashflow-trend-chart.tsx`:

```typescript
"use client";

/** Grafico "Entrate vs uscite": barre affiancate (non impilate) per ciascun mese del periodo selezionato. */

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { CashflowMonthlyEntry } from "@/lib/calc/cashflow";

const CHART_CONFIG = {
  entrate: { label: "Entrate", color: "var(--pos)" },
  uscite: { label: "Uscite", color: "var(--neg)" },
} satisfies ChartConfig;

export interface CashflowTrendChartProps {
  monthlySeries: CashflowMonthlyEntry[];
  currency: string;
}

export function CashflowTrendChart({ monthlySeries, currency }: CashflowTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Entrate vs uscite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
          <BarChart data={monthlySeries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), currency, { maximumFractionDigits: 0 })}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{name === "entrate" ? "Entrate" : "Uscite"}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatCurrency(Number(value), currency)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="entrate" fill="var(--color-entrate)" radius={4} />
            <Bar dataKey="uscite" fill="var(--color-uscite)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Lista fonti di entrata**

Crea `components/domain/cashflow/income-sources-list.tsx`:

```typescript
/** Blocco "Fonti di entrata": una riga per categoria di tipo entrata, con importo e quota % sul totale entrate del periodo. */

import { CategoryAvatar } from "@/components/domain/categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { IncomeSourceAmount } from "@/lib/calc/cashflow";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export interface IncomeSourcesListProps {
  sources: IncomeSourceAmount[];
  currency: string;
}

export function IncomeSourcesList({ sources, currency }: IncomeSourcesListProps) {
  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fonti di entrata
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {sources.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nessuna entrata registrata in questo periodo.</p>
        ) : (
          sources.map((source) => (
            <div key={source.categoryId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <CategoryAvatar
                  color={source.color as CategoryColor}
                  icon={source.icon as CategoryIcon}
                  size={14}
                  className="size-7"
                />
                <p className="text-sm font-medium text-foreground">{source.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums text-pos">{formatCurrency(source.amount, currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {source.quotaPct === null ? "—" : `${Math.round(source.quotaPct)}% del totale`}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Blocco "Dove va ogni euro"**

Crea `components/domain/cashflow/where-it-goes-breakdown.tsx`:

```typescript
/** Blocco "Dove va ogni euro" (mese corrente): Spese fisse, Spese variabili, Risparmio — importo e quota % sul totale entrate del mese. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WhereItGoesEntry } from "@/lib/calc/cashflow";

export interface WhereItGoesBreakdownProps {
  entries: WhereItGoesEntry[];
  currency: string;
}

export function WhereItGoesBreakdown({ entries, currency }: WhereItGoesBreakdownProps) {
  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dove va ogni euro
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {entries.map((entry) => (
          <div key={entry.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm font-medium text-foreground">{entry.label}</p>
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  entry.key === "risparmio" && entry.amount < 0 ? "text-neg" : "text-foreground"
                )}
              >
                {formatCurrency(entry.amount, currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.quotaPct === null ? "—" : `${Math.round(entry.quotaPct)}%`}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Grafico risparmio accumulato**

Crea `components/domain/cashflow/accumulated-savings-chart.tsx`:

```typescript
"use client";

/** Grafico "Risparmio accumulato": linea della somma cumulata del flusso netto lungo il periodo selezionato, con totale finale. */

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { AccumulatedSavingsEntry } from "@/lib/calc/cashflow";

const CHART_CONFIG = {
  cumulative: { label: "Risparmio accumulato", color: "var(--pos)" },
} satisfies ChartConfig;

export interface AccumulatedSavingsChartProps {
  entries: AccumulatedSavingsEntry[];
  currency: string;
}

export function AccumulatedSavingsChart({ entries, currency }: AccumulatedSavingsChartProps) {
  const total = entries.length > 0 ? entries[entries.length - 1].cumulative : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Risparmio accumulato
        </CardTitle>
        <span className="font-heading text-lg font-medium tabular-nums text-foreground">
          {formatCurrency(total, currency)}
        </span>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
          <LineChart data={entries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), currency, { maximumFractionDigits: 0 })}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">Accumulato</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatCurrency(Number(value), currency)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Line type="monotone" dataKey="cumulative" stroke="var(--color-cumulative)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Aggiorna il barrel**

Sostituisci `components/domain/cashflow/index.ts` interamente:

```typescript
/**
 * components/domain/cashflow — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Cash flow.
 */

export { CashflowPeriodSelector } from "./cashflow-period-selector";
export type { CashflowPeriodSelectorProps } from "./cashflow-period-selector";
export { CashflowReferenceNav } from "./cashflow-reference-nav";
export type { CashflowReferenceNavProps } from "./cashflow-reference-nav";
export { CashflowKpiCards } from "./cashflow-kpi-cards";
export type { CashflowKpiCardsProps } from "./cashflow-kpi-cards";
export { CashflowTrendChart } from "./cashflow-trend-chart";
export type { CashflowTrendChartProps } from "./cashflow-trend-chart";
export { IncomeSourcesList } from "./income-sources-list";
export type { IncomeSourcesListProps } from "./income-sources-list";
export { WhereItGoesBreakdown } from "./where-it-goes-breakdown";
export type { WhereItGoesBreakdownProps } from "./where-it-goes-breakdown";
export { AccumulatedSavingsChart } from "./accumulated-savings-chart";
export type { AccumulatedSavingsChartProps } from "./accumulated-savings-chart";
```

- [ ] **Step 6: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add components/domain/cashflow/cashflow-trend-chart.tsx components/domain/cashflow/income-sources-list.tsx components/domain/cashflow/where-it-goes-breakdown.tsx components/domain/cashflow/accumulated-savings-chart.tsx components/domain/cashflow/index.ts
git commit -m "feat: grafici e liste Cash flow (entrate/uscite, fonti, dove va ogni euro, risparmio accumulato)"
```

---

### Task 11: Pagina Cash flow

**Files:**
- Create: `app/(app)/cash-flow/page.tsx`

**Interfaces:**
- Consuma: tutti i componenti del barrel `components/domain/cashflow` (Task 9-10); `useTransactionsQuery(from, to, "tutte")` (Task 4); `useCategoriesQuery`; `computeMonthlySeries`, `computeIncomeSources`, `computeWhereItGoes`, `computeAccumulatedSavings`, `getCashflowPeriodRange` (Task 8).

- [ ] **Step 1: Implementa la pagina**

Crea `app/(app)/cash-flow/page.tsx`:

```typescript
"use client";

/** Pagina Cash flow: cruscotto di sola lettura — confronto entrate/uscite, fonti di entrata, dove va ogni euro, risparmio accumulato. */

import * as React from "react";
import {
  AccumulatedSavingsChart,
  CashflowKpiCards,
  CashflowPeriodSelector,
  CashflowReferenceNav,
  CashflowTrendChart,
  IncomeSourcesList,
  WhereItGoesBreakdown,
} from "@/components/domain/cashflow";
import { authClient } from "@/lib/auth/client";
import {
  computeAccumulatedSavings,
  computeIncomeSources,
  computeMonthlySeries,
  computeWhereItGoes,
  getCashflowPeriodRange,
  type CashflowPeriod,
} from "@/lib/calc/cashflow";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Finestra di fetch: 24 mesi prima del riferimento fino a oggi — copre il periodo massimo selezionabile (24M) più il confronto col periodo precedente. */
function fetchWindow(referenceDate: Date): { from: string; to: string } {
  const from = new Date(referenceDate.getFullYear() - 4, referenceDate.getMonth(), 1);
  const to = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  return { from: toDateString(from), to: toDateString(to) };
}

export default function CashFlowPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const [period, setPeriod] = React.useState<CashflowPeriod>("6mesi");

  const { from, to } = fetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const { data: categories } = useCategoriesQuery();

  const safeTransactions = transactions ?? [];
  const safeCategories = categories ?? [];

  const range = getCashflowPeriodRange(period, referenceDate);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Cash flow</h1>
          <CashflowReferenceNav period={period} referenceDate={referenceDate} onChange={setReferenceDate} />
        </div>
        <CashflowPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare i dati.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <>
          <CashflowKpiCards
            transactions={safeTransactions}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
          />

          <CashflowTrendChart monthlySeries={computeMonthlySeries(safeTransactions, range)} currency={currency} />

          <IncomeSourcesList
            sources={computeIncomeSources(safeTransactions, safeCategories, range)}
            currency={currency}
          />

          <WhereItGoesBreakdown
            entries={computeWhereItGoes(safeTransactions, safeCategories, referenceDate)}
            currency={currency}
          />

          <AccumulatedSavingsChart
            entries={computeAccumulatedSavings(safeTransactions, range)}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Esegui l'intera suite per assicurarti che nulla si sia rotto**

Run: `pnpm test`
Expected: PASS su tutti i file (compresi quelli non toccati da questo piano).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/cash-flow/page.tsx"
git commit -m "feat: pagina Cash flow (KPI, entrate/uscite, fonti, dove va ogni euro, risparmio accumulato)"
```

---

## Verifica manuale (non automatizzabile in questo sandbox)

Nessun Postgres/Redis disponibile per un browser reale nelle sessioni agentiche di questo progetto (stesso vincolo di tutte le feature precedenti). Da verificare manualmente dall'utente dopo il merge:
- Creare una categoria di tipo Entrata da `/categorie`, verificarne icona/colore.
- Registrare un'entrata dal form di Transazioni (toggle Spesa/Entrata), verificare che compaia con importo positivo e non influenzi KPI/donut/trend di Transazioni.
- Toggle Tutte/Uscite/Entrate sulla lista Transazioni.
- Editare l'importo di un'entrata esistente (deve restare positiva) e provare a cambiarne la categoria verso una incompatibile (deve fallire, tranne verso "Da categorizzare").
- Pagina Cash flow: 4 KPI, grafico entrate/uscite, fonti di entrata, dove va ogni euro (mese corrente), risparmio accumulato — su tutti e 4 i periodi (3M/6M/12M/24M) e navigando avanti/indietro.
