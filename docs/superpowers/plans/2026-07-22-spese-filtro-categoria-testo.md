# Spese — filtro categoria/testo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere alla schermata Spese un filtro per categoria (singola selezione) e per testo (descrizione), che ricalcola globalmente KPI, torta "Per categoria", grafico "Andamento 6 mesi" e lista transazioni.

**Architecture:** Nuova funzione pura `filterTransactions` in `lib/calc/expenses.ts` applicata a monte di tutte le funzioni di calcolo esistenti in `app/(app)/spese/page.tsx`. Nuovo componente controllato `ExpensesFilterBar` (select categoria + input testo) in `components/domain/expenses/`. Nessuna modifica a schema DB, API, o funzioni di calcolo esistenti.

**Tech Stack:** Next.js App Router, TypeScript, React (client component), vitest per i test, componenti shadcn `Select`/`Input`.

## Global Constraints

- Tutte le stringhe visibili in italiano (nessuna i18n ancora).
- Nessun colore/raggio hardcoded: usare classi Tailwind/token tema esistenti.
- JSDoc minimo (una riga `/**`) su ogni componente/funzione pubblica.
- Componenti dominio compongono primitive `components/ui/`, nessuna logica di business nei file `app/*/page.tsx` oltre all'orchestrazione già presente.
- Barrel `components/domain/expenses/index.ts` è l'unico punto di import esterno per questi componenti.

---

### Task 1: `filterTransactions` — funzione pura + test

**Files:**
- Modify: `lib/calc/expenses.ts`
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: tipo `Transaction` da `@/lib/db/schema/transactions` (campi usati: `categoryId: string`, `description: string`), già importato in `lib/calc/expenses.ts`.
- Produces:
  ```ts
  export interface TransactionFilter {
    categoryId: string | null;
    searchText: string;
  }
  export function filterTransactions(
    transactions: Transaction[],
    filter: TransactionFilter
  ): Transaction[]
  ```
  Usato da Task 3 in `app/(app)/spese/page.tsx`.

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi in fondo a `lib/calc/expenses.test.ts` (dopo l'ultimo `describe` esistente), riusando l'helper `makeTransaction` già presente nel file:

```ts
describe("filterTransactions", () => {
  it("senza filtri restituisce tutte le transazioni invariate", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "" });
    expect(result).toEqual(transactions);
  });

  it("filtra per categoryId esatto", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: "category-2", searchText: "" });
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });

  it("filtra per testo, substring case-insensitive sulla descrizione", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare Esselunga" }),
      makeTransaction({ id: "t2", categoryId: "category-1", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "esselunga" });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("combina categoria e testo in AND", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa Esselunga" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Spesa Esselunga" }),
    ];
    const result = filterTransactions(transactions, { categoryId: "category-1", searchText: "esselunga" });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("nessun match restituisce array vuoto", () => {
    const transactions = [makeTransaction({ id: "t1", description: "Cinema" })];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "ristorante" });
    expect(result).toEqual([]);
  });

  it("ignora spazi bianchi attorno al testo di ricerca", () => {
    const transactions = [makeTransaction({ id: "t1", description: "Cinema" })];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "  cinema  " });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });
});
```

Aggiungi `filterTransactions` all'import esistente da `"./expenses"` in cima al file di test.

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `filterTransactions is not a function` (o errore di tipo import).

- [ ] **Step 3: Implementa `filterTransactions`**

Aggiungi in fondo a `lib/calc/expenses.ts`:

```ts
export interface TransactionFilter {
  categoryId: string | null;
  searchText: string;
}

/** Filtra le transazioni per categoria esatta e/o substring case-insensitive sulla descrizione, in AND. */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[] {
  const normalizedSearch = filter.searchText.trim().toLocaleLowerCase();
  return transactions.filter((t) => {
    if (filter.categoryId !== null && t.categoryId !== filter.categoryId) return false;
    if (normalizedSearch !== "" && !t.description.toLocaleLowerCase().includes(normalizedSearch)) return false;
    return true;
  });
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS, tutti i test incluso il nuovo blocco `filterTransactions`.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiunge filterTransactions per filtro categoria/testo in Spese"
```

---

### Task 2: `ExpensesFilterBar` — componente UI

**Files:**
- Create: `components/domain/expenses/expenses-filter-bar.tsx`
- Modify: `components/domain/expenses/index.ts`

**Interfaces:**
- Consumes: tipo `Category` da `@/lib/db/schema/categories` (campi `id`, `name`, `color`, `icon`); `CategoryAvatar` da `@/components/domain/categories`; `CategoryColor`/`CategoryIcon` da `@/lib/validation/categories`; `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` da `@/components/ui/select`; `Input` da `@/components/ui/input`.
- Produces:
  ```ts
  export interface ExpensesFilterBarProps {
    categories: Category[];
    categoryId: string | null;
    onCategoryChange: (categoryId: string | null) => void;
    searchText: string;
    onSearchTextChange: (text: string) => void;
  }
  export function ExpensesFilterBar(props: ExpensesFilterBarProps): JSX.Element
  ```
  Usato da Task 3 in `app/(app)/spese/page.tsx`.

Nessun test automatico per questo componente (nessun test esistente per gli altri componenti UI puri di questa cartella, es. `expenses-period-selector.tsx`, `transaction-row.tsx` — pattern coerente con la codebase). Verifica manuale prevista a fine piano.

- [ ] **Step 1: Crea il componente**

`components/domain/expenses/expenses-filter-bar.tsx`:

```tsx
"use client";

/** Barra filtri della schermata Spese: select categoria singola + ricerca testo su descrizione, entrambi controllati. */

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryAvatar } from "@/components/domain/categories";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

const ALL_CATEGORIES_VALUE = "__all__";

export interface ExpensesFilterBarProps {
  categories: Category[];
  /** null = nessun filtro categoria attivo ("Tutte le categorie"). */
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
}

export function ExpensesFilterBar({
  categories,
  categoryId,
  onCategoryChange,
  searchText,
  onSearchTextChange,
}: ExpensesFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={categoryId ?? ALL_CATEGORIES_VALUE}
        onValueChange={(value) => onCategoryChange(value === ALL_CATEGORIES_VALUE ? null : value)}
      >
        <SelectTrigger size="sm" className="w-56">
          <SelectValue>
            {(value: string) => {
              if (value === ALL_CATEGORIES_VALUE) return "Tutte le categorie";
              const selected = categories.find((c) => c.id === value);
              if (!selected) return "Tutte le categorie";
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
          <SelectItem value={ALL_CATEGORIES_VALUE}>Tutte le categorie</SelectItem>
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

      <Input
        value={searchText}
        onChange={(e) => onSearchTextChange(e.target.value)}
        placeholder="Cerca per descrizione..."
        className="h-8 w-56"
        aria-label="Cerca transazioni per descrizione"
      />
    </div>
  );
}
```

- [ ] **Step 2: Esporta dal barrel**

Aggiungi in `components/domain/expenses/index.ts` (dopo l'export di `ExpensesPeriodSelector`, mantenendo l'ordine alfabetico approssimativo esistente):

```ts
export { ExpensesFilterBar } from "./expenses-filter-bar";
export type { ExpensesFilterBarProps } from "./expenses-filter-bar";
```

- [ ] **Step 3: Verifica il build/lint**

Run: `pnpm build`
Expected: build completa senza errori TypeScript (il componente non è ancora usato in nessuna pagina, ma deve compilare in isolamento).

- [ ] **Step 4: Commit**

```bash
git add components/domain/expenses/expenses-filter-bar.tsx components/domain/expenses/index.ts
git commit -m "feat: aggiunge ExpensesFilterBar (select categoria + ricerca testo)"
```

---

### Task 3: integrazione in `app/(app)/spese/page.tsx`

**Files:**
- Modify: `app/(app)/spese/page.tsx`

**Interfaces:**
- Consumes: `filterTransactions`/`TransactionFilter` da `@/lib/calc/expenses` (Task 1); `ExpensesFilterBar`/`ExpensesFilterBarProps` da `@/components/domain/expenses` (Task 2).
- Produces: nessuna nuova interfaccia pubblica (file di route, orchestrazione terminale).

- [ ] **Step 1: Aggiungi stato filtro e importa i nuovi simboli**

In `app/(app)/spese/page.tsx`, aggiorna l'import da `@/components/domain/expenses` (riga 6-13) aggiungendo `ExpensesFilterBar`:

```ts
import {
  AddTransactionForm,
  CategoryBreakdownDonut,
  ExpensesFilterBar,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpenseTrendChart,
  TransactionRow,
} from "@/components/domain/expenses";
```

Aggiorna l'import da `@/lib/calc/expenses` (riga 16-23) aggiungendo `filterTransactions`:

```ts
import {
  compute6MonthTrend,
  computeCategoryBreakdown,
  computeFixedVsVariable,
  computeSummary,
  filterTransactions,
  getPeriodRange,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
```

Aggiungi il nuovo stato subito dopo `showUncategorizedOnly` (riga 45):

```ts
const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
const [searchText, setSearchText] = React.useState("");
```

- [ ] **Step 2: Calcola `filteredTransactions` e `filteredBudgets`, sostituisci gli usi di `safeTransactions`/`safeBudgets` a valle**

Subito dopo la riga `const safeBudgets = budgets ?? [];` (riga 54), aggiungi:

```ts
const filteredTransactions = filterTransactions(safeTransactions, {
  categoryId: categoryFilter,
  searchText,
});
const filteredBudgets = categoryFilter
  ? safeBudgets.filter((b) => b.categoryId === categoryFilter)
  : safeBudgets;
```

Sostituisci nel corpo del componente (righe 56-69, blocco `fallbackCategoryIds`/`transactionsInPeriodAll`/`uncategorizedCount`/`transactionsInPeriod`) ogni riferimento a `safeTransactions` con `filteredTransactions`:

```ts
const fallbackCategoryIds = new Set(
  safeCategories.filter((c) => c.isFallback).map((c) => c.id)
);

const range = getPeriodRange(period, referenceDate);
const transactionsInPeriodAll = filteredTransactions.filter(
  (t) => t.date >= toDateString(range.from) && t.date <= toDateString(range.to)
);
const uncategorizedCount = transactionsInPeriodAll.filter(
  (t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId)
).length;
const transactionsInPeriod = showUncategorizedOnly
  ? transactionsInPeriodAll.filter((t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId))
  : transactionsInPeriodAll;

const hasActiveFilter = categoryFilter !== null || searchText.trim() !== "";
```

- [ ] **Step 3: Inserisci `ExpensesFilterBar` in JSX e passa `filteredTransactions`/`filteredBudgets` ai componenti a valle**

Subito dopo il blocco header (dopo il `</div>` di chiusura della riga 106, prima di `{isLoading ? (` a riga 108), aggiungi:

```tsx
<ExpensesFilterBar
  categories={safeCategories}
  categoryId={categoryFilter}
  onCategoryChange={setCategoryFilter}
  searchText={searchText}
  onSearchTextChange={setSearchText}
/>
```

Aggiorna le chiamate esistenti nel blocco `else` (righe 122-176):

- `ExpensesKpiCards`: sostituisci `transactions={safeTransactions}` con `transactions={filteredTransactions}` e `budgets={safeBudgets}` con `budgets={filteredBudgets}`.
- `CategoryBreakdownDonut`: sostituisci `computeCategoryBreakdown(safeTransactions, ...)` con `computeCategoryBreakdown(filteredTransactions, ...)` e `computeFixedVsVariable(safeTransactions, ...)` con `computeFixedVsVariable(filteredTransactions, ...)`.
- Il riepilogo uscite/escluse/spese effettive sopra la lista: sostituisci `computeSummary(safeTransactions, range)` con `computeSummary(filteredTransactions, range)`.
- `ExpenseTrendChart`: sostituisci `compute6MonthTrend(safeTransactions, referenceDate)` con `compute6MonthTrend(filteredTransactions, referenceDate)`.

- [ ] **Step 4: Aggiorna il messaggio di lista vuota**

Sostituisci il blocco messaggio vuoto esistente (righe 153-158):

```tsx
{transactionsInPeriod.length === 0 ? (
  <p className="p-6 text-sm text-muted-foreground">
    {showUncategorizedOnly
      ? "Nessuna transazione da categorizzare in questo periodo."
      : "Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto."}
  </p>
) : (
```

con:

```tsx
{transactionsInPeriod.length === 0 ? (
  <p className="p-6 text-sm text-muted-foreground">
    {showUncategorizedOnly
      ? "Nessuna transazione da categorizzare in questo periodo."
      : hasActiveFilter
        ? "Nessuna transazione corrisponde ai filtri applicati in questo periodo."
        : "Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto."}
  </p>
) : (
```

- [ ] **Step 5: Verifica build e lint**

Run: `pnpm build`
Expected: build completa senza errori TypeScript.

Run: `pnpm lint`
Expected: nessun nuovo errore introdotto (i 2 errori pre-esistenti `react-hooks/set-state-in-effect` documentati in `CLAUDE.md` restano invariati).

- [ ] **Step 6: Esegui l'intera suite di test**

Run: `pnpm exec vitest run`
Expected: PASS, tutti i test incluso il nuovo blocco `filterTransactions` di Task 1.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/spese/page.tsx
git commit -m "feat: integra filtro categoria/testo nella pagina Spese"
```

---

## Verifica manuale finale (fuori dai task automatizzabili)

Nessun Postgres/Redis disponibile nel sandbox agentico (stessa limitazione già documentata in `CLAUDE.md` per le feature precedenti di Spese). Da verificare manualmente in browser dall'utente a fine piano:

- Selezionare una categoria dal filtro → lista, KPI, torta e trend si aggiornano solo su quella categoria; "Budget rimanente" mostra il budget della categoria selezionata.
- Digitare testo di ricerca → lista/KPI/torta/trend filtrano per substring case-insensitive sulla descrizione.
- Combinare categoria + testo → filtro AND.
- Tornare a "Tutte le categorie" e svuotare il testo → viene ripristinata la vista completa.
- Nessun risultato con filtri attivi → messaggio "Nessuna transazione corrisponde ai filtri applicati in questo periodo".
