# Ordinamento configurabile legenda "Per categoria" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un controllo di ordinamento (percentuale sul totale / valore speso / % budget / nome, asc o desc) alla legenda del blocco "Per categoria" in Spese, senza toccare l'ordine delle fette del donut.

**Architecture:** Nuova funzione pura `sortLegendEntries` in `category-breakdown-donut.utils.ts` (testata in isolamento), più stato locale (`sortCriterion`/`sortDirection`) e un enrichment pre-sort in `CategoryBreakdownDonut` che calcola `budgetAmount`/`saturazionePct`/`quotaPct` per tutte le categorie prima di ordinare (oggi calcolati dentro il loop di render). UI: `Select` + bottone toggle direzione nel `CardHeader`.

**Tech Stack:** React 19 + TypeScript, vitest, componenti shadcn (`Select`), `lucide-react`.

## Global Constraints

- Stringhe visibili in italiano (nessuna i18n ancora, vedi CLAUDE.md).
- Nessun colore/valore hardcoded fuori dai token tema esistenti — questa feature non introduce nuovi colori.
- Il file `category-breakdown-donut.tsx` esiste già e supera ~150 righe: non è nello scope di questo piano risistemarlo, solo estenderlo secondo il pattern esistente (JSDoc minimo, tipi esportati, niente logica di business fuori da questi due file).

---

### Task 1: `sortLegendEntries` in `category-breakdown-donut.utils.ts`

**Files:**
- Modify: `components/domain/expenses/category-breakdown-donut.utils.ts`
- Test: `components/domain/expenses/category-breakdown-donut.utils.test.ts`

**Interfaces:**
- Consumes: `CategoryAmount` da `@/lib/calc/expenses` (già importato nel file).
- Produces:
  - `export type LegendSortCriterion = "percentuale" | "valore" | "budget" | "nome";`
  - `export type LegendSortDirection = "asc" | "desc";`
  - `export interface LegendEntry extends CategoryAmount { budgetAmount: number; saturazionePct: number | null; quotaPct: number | null; }`
  - `export function sortLegendEntries(entries: LegendEntry[], criterion: LegendSortCriterion, direction: LegendSortDirection): LegendEntry[]`
  - `export const LEGEND_SORT_DEFAULT_DIRECTION: Record<LegendSortCriterion, LegendSortDirection>` (mappa usata dal Task 2 per resettare la direzione al cambio criterio: `{ percentuale: "desc", valore: "desc", budget: "desc", nome: "asc" }`)

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi in fondo a `components/domain/expenses/category-breakdown-donut.utils.test.ts` (import aggiornato in cima: `import { computeBudgetStats, sortCategoryAmounts, sortLegendEntries, type LegendEntry } from "./category-breakdown-donut.utils";`):

```ts
function makeLegendEntry(overrides: Partial<LegendEntry>): LegendEntry {
  return {
    categoryId: "id",
    name: "Categoria",
    type: "variabile",
    amount: 0,
    color: "slate",
    icon: "package",
    budgetAmount: 0,
    saturazionePct: null,
    quotaPct: null,
    ...overrides,
  };
}

describe("sortLegendEntries", () => {
  it("ordina per percentuale sul totale decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", quotaPct: 10 }),
      makeLegendEntry({ categoryId: "high", quotaPct: 80 }),
    ];
    const result = sortLegendEntries(input, "percentuale", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per percentuale sul totale crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", quotaPct: 10 }),
      makeLegendEntry({ categoryId: "high", quotaPct: 80 }),
    ];
    const result = sortLegendEntries(input, "percentuale", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per valore speso decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", amount: 5 }),
      makeLegendEntry({ categoryId: "high", amount: 50 }),
    ];
    const result = sortLegendEntries(input, "valore", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per valore speso crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", amount: 5 }),
      makeLegendEntry({ categoryId: "high", amount: 50 }),
    ];
    const result = sortLegendEntries(input, "valore", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per saturazione budget decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", saturazionePct: 20 }),
      makeLegendEntry({ categoryId: "high", saturazionePct: 90 }),
    ];
    const result = sortLegendEntries(input, "budget", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per saturazione budget crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", saturazionePct: 20 }),
      makeLegendEntry({ categoryId: "high", saturazionePct: 90 }),
    ];
    const result = sortLegendEntries(input, "budget", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per nome A-Z", () => {
    const input = [
      makeLegendEntry({ categoryId: "z", name: "Zaino" }),
      makeLegendEntry({ categoryId: "a", name: "Affitto" }),
    ];
    const result = sortLegendEntries(input, "nome", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["a", "z"]);
  });

  it("ordina per nome Z-A", () => {
    const input = [
      makeLegendEntry({ categoryId: "z", name: "Zaino" }),
      makeLegendEntry({ categoryId: "a", name: "Affitto" }),
    ];
    const result = sortLegendEntries(input, "nome", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["z", "a"]);
  });

  it("mette le percentuali null sempre in fondo, indipendentemente dalla direzione", () => {
    const input = [
      makeLegendEntry({ categoryId: "no-budget", quotaPct: null }),
      makeLegendEntry({ categoryId: "has-value", quotaPct: 50 }),
    ];
    const desc = sortLegendEntries(input, "percentuale", "desc");
    expect(desc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
    const asc = sortLegendEntries(input, "percentuale", "asc");
    expect(asc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
  });

  it("mette le saturazioni budget null sempre in fondo, indipendentemente dalla direzione", () => {
    const input = [
      makeLegendEntry({ categoryId: "no-budget", saturazionePct: null }),
      makeLegendEntry({ categoryId: "has-value", saturazionePct: 50 }),
    ];
    const desc = sortLegendEntries(input, "budget", "desc");
    expect(desc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
    const asc = sortLegendEntries(input, "budget", "asc");
    expect(asc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
  });

  it("non genera errori quando tutti i valori sono null", () => {
    const input = [
      makeLegendEntry({ categoryId: "a", quotaPct: null }),
      makeLegendEntry({ categoryId: "b", quotaPct: null }),
    ];
    const result = sortLegendEntries(input, "percentuale", "desc");
    expect(result.map((e) => e.categoryId).sort()).toEqual(["a", "b"]);
  });

  it("non modifica l'array originale", () => {
    const input = [
      makeLegendEntry({ categoryId: "a", amount: 1 }),
      makeLegendEntry({ categoryId: "b", amount: 2 }),
    ];
    const originalOrder = input.map((e) => e.categoryId);
    sortLegendEntries(input, "valore", "desc");
    expect(input.map((e) => e.categoryId)).toEqual(originalOrder);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm vitest run components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: FAIL — `sortLegendEntries`/`LegendEntry` non esistono ancora nel modulo.

- [ ] **Step 3: Implementa `sortLegendEntries` in `category-breakdown-donut.utils.ts`**

Aggiungi in fondo al file (dopo `computeBudgetStats`):

```ts
export type LegendSortCriterion = "percentuale" | "valore" | "budget" | "nome";
export type LegendSortDirection = "asc" | "desc";

export const LEGEND_SORT_DEFAULT_DIRECTION: Record<LegendSortCriterion, LegendSortDirection> = {
  percentuale: "desc",
  valore: "desc",
  budget: "desc",
  nome: "asc",
};

export interface LegendEntry extends CategoryAmount {
  budgetAmount: number;
  saturazionePct: number | null;
  quotaPct: number | null;
}

/** Confronta due valori nullable: null perde sempre (va in fondo), indipendentemente dalla direzione richiesta. */
function compareNullable(a: number | null, b: number | null, direction: LegendSortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "desc" ? b - a : a - b;
}

/**
 * Ordina le voci della legenda "Per categoria" secondo il criterio scelto dall'utente (percentuale sul totale,
 * valore speso, saturazione budget o nome). Non tocca l'ordinamento delle fette del donut (sortCategoryAmounts).
 * Valori null (budget/totale a 0) restano sempre in fondo alla lista qualunque sia la direzione.
 */
export function sortLegendEntries(
  entries: LegendEntry[],
  criterion: LegendSortCriterion,
  direction: LegendSortDirection
): LegendEntry[] {
  return [...entries].sort((a, b) => {
    switch (criterion) {
      case "percentuale":
        return compareNullable(a.quotaPct, b.quotaPct, direction);
      case "budget":
        return compareNullable(a.saturazionePct, b.saturazionePct, direction);
      case "valore":
        return direction === "desc" ? b.amount - a.amount : a.amount - b.amount;
      case "nome":
        return direction === "desc" ? b.name.localeCompare(a.name, "it") : a.name.localeCompare(b.name, "it");
    }
  });
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm vitest run components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: PASS (tutti i test, inclusi quelli preesistenti di `sortCategoryAmounts`/`computeBudgetStats`).

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.utils.ts components/domain/expenses/category-breakdown-donut.utils.test.ts
git commit -m "feat: aggiungi sortLegendEntries per ordinamento configurabile legenda categorie"
```

---

### Task 2: UI ordinamento in `CategoryBreakdownDonut`

**Files:**
- Modify: `components/domain/expenses/category-breakdown-donut.tsx`

**Interfaces:**
- Consumes da Task 1: `sortLegendEntries`, `LegendSortCriterion`, `LegendSortDirection`, `LegendEntry`, `LEGEND_SORT_DEFAULT_DIRECTION` da `./category-breakdown-donut.utils`.
- Produces: nessuna nuova esportazione pubblica — solo comportamento del componente `CategoryBreakdownDonut` già esportato.

- [ ] **Step 1: Aggiorna l'import da `./category-breakdown-donut.utils`**

In `components/domain/expenses/category-breakdown-donut.tsx:27`, sostituisci:

```ts
import { computeBudgetStats, sortCategoryAmounts } from "./category-breakdown-donut.utils";
```

con:

```ts
import {
  computeBudgetStats,
  LEGEND_SORT_DEFAULT_DIRECTION,
  sortCategoryAmounts,
  sortLegendEntries,
  type LegendEntry,
  type LegendSortCriterion,
  type LegendSortDirection,
} from "./category-breakdown-donut.utils";
```

Aggiungi anche l'import dell'icona toggle e del `Select`, subito sotto gli import esistenti (riga 11 e riga 17):

```ts
import { ArrowDownIcon, ArrowUpIcon, Package } from "lucide-react";
```

```ts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

E aggiorna l'import di `Card`/`CardHeader`/... (riga 18) per includere `CardAction`, il contenitore già pensato da shadcn per un'azione a destra del titolo (grid `col-start-2`, evita di dover convertire `CardHeader` da grid a flex):

```ts
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
```

- [ ] **Step 2: Aggiungi le opzioni di ordinamento e lo stato nel componente**

Subito dopo `const BUDGET_OVER_THRESHOLD_PCT = 100;` (riga 35), aggiungi:

```ts
const LEGEND_SORT_OPTIONS: { value: LegendSortCriterion; label: string }[] = [
  { value: "percentuale", label: "% sul totale" },
  { value: "valore", label: "Valore speso" },
  { value: "budget", label: "% budget" },
  { value: "nome", label: "Nome" },
];
```

Dentro `CategoryBreakdownDonut`, subito dopo gli state esistenti `pendingCategoryId`/`errorCategoryId` (dopo riga 91), aggiungi:

```ts
const [sortCriterion, setSortCriterion] = React.useState<LegendSortCriterion>("percentuale");
const [sortDirection, setSortDirection] = React.useState<LegendSortDirection>("desc");

function handleCriterionChange(next: LegendSortCriterion) {
  setSortCriterion(next);
  setSortDirection(LEGEND_SORT_DEFAULT_DIRECTION[next]);
}
```

- [ ] **Step 3: Calcola le voci arricchite e ordinale prima del render**

Sostituisci la riga `const sortedEntries = sortCategoryAmounts(categoryAmounts);` (riga 118) mantenendola invariata (serve ancora per `outerData` del donut) e aggiungi subito dopo (dopo il calcolo di `totalSpeso`, riga 119):

```ts
const enrichedEntries: LegendEntry[] = categoryAmounts.map((entry) => {
  const budgetAmount = budgetFor(entry.categoryId);
  const { saturazionePct, quotaPct } = computeBudgetStats(entry.amount, budgetAmount, totalSpeso);
  return { ...entry, budgetAmount, saturazionePct, quotaPct };
});
const sortedLegendEntries = sortLegendEntries(enrichedEntries, sortCriterion, sortDirection);
```

- [ ] **Step 4: Aggiorna l'effect di scroll per usare la nuova lista**

Nel `React.useEffect` che dipende da `sortedEntries.length` (riga 133-144), cambia la dependency array da `[checkScroll, sortedEntries.length]` a `[checkScroll, sortedLegendEntries.length]` (la lista che effettivamente determina l'altezza scrollabile è quella della legenda).

- [ ] **Step 5: Sostituisci il rendering della legenda**

Nel blocco `{sortedEntries.map((entry) => { ... })}` dentro il `div` con `ref={scrollRef}` (righe 219-235), sostituisci `sortedEntries.map` con `sortedLegendEntries.map` e usa i valori già calcolati invece di richiamare `budgetFor`/`computeBudgetStats`:

```tsx
{sortedLegendEntries.map((entry) => (
  <CategoryLegendRow
    key={entry.categoryId}
    entry={entry}
    budgetAmount={entry.budgetAmount}
    saturazionePct={entry.saturazionePct}
    quotaPct={entry.quotaPct}
    currency={currency}
    isSaving={pendingCategoryId === entry.categoryId}
    hasError={errorCategoryId === entry.categoryId}
    onCommitBudget={(raw) => commitBudget(entry.categoryId, raw)}
  />
))}
```

- [ ] **Step 6: Aggiungi i controlli di ordinamento nel `CardHeader`**

Sostituisci il blocco `CardHeader` esistente (righe 168-172):

```tsx
<CardHeader className="pt-4">
  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    Per categoria
  </CardTitle>
</CardHeader>
```

con (usa `CardAction`, lo slot che shadcn prevede già per un'azione a destra del titolo dentro un `CardHeader` che resta grid — niente conversione a flex):

```tsx
<CardHeader className="pt-4">
  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    Per categoria
  </CardTitle>
  <CardAction className="flex items-center gap-1">
    <Select value={sortCriterion} onValueChange={(value) => handleCriterionChange(value as LegendSortCriterion)}>
      <SelectTrigger size="sm" className="w-36">
        <SelectValue>{(value: LegendSortCriterion) => LEGEND_SORT_OPTIONS.find((o) => o.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LEGEND_SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <button
      type="button"
      onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
      aria-label={sortDirection === "desc" ? "Ordina crescente" : "Ordina decrescente"}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {sortDirection === "desc" ? <ArrowDownIcon className="size-4" /> : <ArrowUpIcon className="size-4" />}
    </button>
  </CardAction>
</CardHeader>
```

- [ ] **Step 7: Verifica build e test**

Run: `pnpm tsc --noEmit`
Expected: nessun errore di tipo.

Run: `pnpm vitest run components/domain/expenses`
Expected: PASS su tutti i test della cartella (inclusi quelli di Task 1).

Run: `pnpm lint`
Expected: nessun nuovo errore introdotto da questo file (il debito preesistente `react-hooks/set-state-in-effect` su `CategoryLegendRow`/`theme-toggle.tsx`, già noto e fuori scope, può restare).

- [ ] **Step 8: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.tsx
git commit -m "feat: select ordinamento + toggle direzione nella legenda Per categoria"
```

---

## Verifica manuale (fuori dai task, da fare dall'utente)

Nessun Postgres/Redis disponibile nel sandbox agentico (vincolo noto, vedi CLAUDE.md). Da controllare in browser reale dopo il merge:
- Il default all'apertura è "% sul totale" decrescente.
- Cambiare criterio resetta la direzione al default previsto (nome → A-Z, altri → decrescente).
- Il toggle inverte correttamente la direzione per il criterio corrente.
- Categorie con budget 0 (percentuale "—") finiscono sempre in fondo quando il criterio è "% budget", qualunque sia la direzione.
- Le fette del donut non cambiano ordine/colore quando si cambia l'ordinamento della legenda.
