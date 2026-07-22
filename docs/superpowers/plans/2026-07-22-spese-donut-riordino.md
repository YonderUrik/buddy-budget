# Spese: torta multilivello e riordino sezioni — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il donut "Fisse vs variabili" + la lista budget separata con una torta multilivello unica (layer interno tipo, layer esterno categoria) con legenda budget/percentuali integrata, e spostare la lista transazioni sopra il grafico "Andamento ultimi 6 mesi".

**Architecture:** Nuovo componente `CategoryBreakdownDonut` (nested `<Pie>` recharts + legenda custom) sostituisce `CategoryBreakdown` e la parte donut di `ExpenseCharts`; `ExpenseCharts` viene rinominato `ExpenseTrendChart` e trattiene solo il bar chart. Nessuna nuova funzione di calcolo: `computeCategoryBreakdown`/`computeFixedVsVariable` esistenti bastano. Un nuovo modulo puro (`category-breakdown-donut.utils.ts`) isola ordinamento categorie e calcolo percentuali, testato con vitest.

**Tech Stack:** Next.js App Router, TypeScript, recharts (via `ChartContainer`/`ChartTooltip` di shadcn), TanStack Query (`useUpsertBudgetMutation` esistente), vitest.

## Global Constraints

- Tutte le stringhe visibili all'utente in italiano (vedi CLAUDE.md — "Convenzioni componenti").
- Nessun colore hardcoded nei componenti: usare token tema. Eccezione tecnica documentata in Task 1: i valori hex per la torta (fill di `Cell` recharts, che richiede un valore CSS letterale, non una classe Tailwind) vivono **solo** come nuovi token in `app/globals.css` (`:root` e `.dark`), mai come stringa letterale in un componente.
- JSDoc minimo (una riga `/** ... */`) su ogni componente e funzione pubblica esportata.
- Import esterni sempre dal barrel `components/domain/expenses/index.ts`, mai dai file interni.
- `components/domain/` non deve dipendere da `app/`.
- Package manager: pnpm. Test: `pnpm exec vitest run <path>`. Build: `pnpm build`. Lint: `pnpm lint`.
- Nessuna modifica a `lib/calc/expenses.ts`, alle route API, a `SplitSlider` o `TransactionRow`.

---

### Task 1: Token colore per la torta categorie

**Files:**
- Modify: `app/globals.css` (blocchi `:root` e `.dark`)
- Modify: `components/domain/shared/color-swatches.ts`

**Interfaces:**
- Produces: `SWATCH_CHART_COLOR: Record<SwatchColor, string>` — mappa ogni `SwatchColor` (`slate`/`blue`/`green`/`yellow`/`purple`/`orange`/`red`/`teal`) a una stringa `var(--swatch-<colore>)` utilizzabile come `fill` letterale in un `Cell` recharts.

**Nota:** nessun test dedicato per questo task — `COLOR_SWATCH_MAP` e `COLOR_DOT`, già esistenti nello stesso file, sono mappe statiche prive di test, stessa convenzione qui.

- [ ] **Step 1: Aggiungi gli 8 nuovi token colore a `app/globals.css`**

Nel blocco `:root` (dopo la riga `--chart-5: #b6c4bc;`, riga 87), aggiungi:

```css
  --swatch-slate: #94a3b8;
  --swatch-blue: #3b82f6;
  --swatch-green: #22c55e;
  --swatch-yellow: #facc15;
  --swatch-purple: #a855f6;
  --swatch-orange: #f97316;
  --swatch-red: #ef4444;
  --swatch-teal: #14b8a6;
```

Nel blocco `.dark` (dopo la riga `--chart-5: #2f4940;`, riga 129), aggiungi lo stesso blocco (stessi valori — le swatch color già oggi non variano per tema, vedi `COLOR_DOT` nello stesso file che usa un'unica classe senza variante `dark:`):

```css
  --swatch-slate: #94a3b8;
  --swatch-blue: #3b82f6;
  --swatch-green: #22c55e;
  --swatch-yellow: #facc15;
  --swatch-purple: #a855f6;
  --swatch-orange: #f97316;
  --swatch-red: #ef4444;
  --swatch-teal: #14b8a6;
```

- [ ] **Step 2: Aggiungi la mappa `SWATCH_CHART_COLOR` in `color-swatches.ts`**

Apri `components/domain/shared/color-swatches.ts` e aggiungi in fondo al file (dopo `COLOR_DOT`):

```ts
/** Mappa colore -> CSS var per la torta multilivello (recharts richiede un valore letterale, non una classe Tailwind). */
export const SWATCH_CHART_COLOR: Record<SwatchColor, string> = {
  slate: "var(--swatch-slate)",
  blue: "var(--swatch-blue)",
  green: "var(--swatch-green)",
  yellow: "var(--swatch-yellow)",
  purple: "var(--swatch-purple)",
  orange: "var(--swatch-orange)",
  red: "var(--swatch-red)",
  teal: "var(--swatch-teal)",
};
```

- [ ] **Step 3: Verifica che il progetto compili**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore (il file esporta solo una nuova costante, nessun consumatore ancora).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/domain/shared/color-swatches.ts
git commit -m "feat: aggiunge token colore swatch per la torta categorie spese"
```

---

### Task 2: Modulo puro `category-breakdown-donut.utils.ts` (TDD)

**Files:**
- Create: `components/domain/expenses/category-breakdown-donut.utils.ts`
- Test: `components/domain/expenses/category-breakdown-donut.utils.test.ts`

**Interfaces:**
- Consumes: `CategoryAmount` da `@/lib/calc/expenses` (già esiste: `{ categoryId, name, type: "fissa"|"variabile", amount, color, icon }`).
- Produces:
  - `sortCategoryAmounts(categoryAmounts: CategoryAmount[]): CategoryAmount[]`
  - `computeBudgetStats(amount: number, budgetAmount: number, totalSpeso: number): BudgetStats`
  - `interface BudgetStats { saturazionePct: number | null; quotaPct: number | null }`

- [ ] **Step 1: Scrivi i test (falliranno — il modulo non esiste ancora)**

Crea `components/domain/expenses/category-breakdown-donut.utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeBudgetStats, sortCategoryAmounts } from "./category-breakdown-donut.utils";
import type { CategoryAmount } from "@/lib/calc/expenses";

function makeEntry(overrides: Partial<CategoryAmount>): CategoryAmount {
  return {
    categoryId: "id",
    name: "Categoria",
    type: "variabile",
    amount: 0,
    color: "slate",
    icon: "package",
    ...overrides,
  };
}

describe("sortCategoryAmounts", () => {
  it("mette tutte le categorie fisse prima delle variabili", () => {
    const input = [
      makeEntry({ categoryId: "v1", type: "variabile", amount: 100 }),
      makeEntry({ categoryId: "f1", type: "fissa", amount: 10 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["f1", "v1"]);
  });

  it("dentro lo stesso tipo ordina per importo decrescente", () => {
    const input = [
      makeEntry({ categoryId: "f-low", type: "fissa", amount: 10 }),
      makeEntry({ categoryId: "f-high", type: "fissa", amount: 50 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["f-high", "f-low"]);
  });

  it("mantiene le categorie a importo zero nell'ordinamento", () => {
    const input = [
      makeEntry({ categoryId: "zero", type: "variabile", amount: 0 }),
      makeEntry({ categoryId: "speso", type: "variabile", amount: 20 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["speso", "zero"]);
  });

  it("non modifica l'array originale", () => {
    const input = [makeEntry({ categoryId: "a", amount: 1 }), makeEntry({ categoryId: "b", amount: 2 })];
    const originalOrder = input.map((e) => e.categoryId);
    sortCategoryAmounts(input);
    expect(input.map((e) => e.categoryId)).toEqual(originalOrder);
  });
});

describe("computeBudgetStats", () => {
  it("calcola la saturazione normale del budget", () => {
    expect(computeBudgetStats(50, 100, 200).saturazionePct).toBe(50);
  });

  it("saturazione oltre il 100% quando si supera il budget", () => {
    expect(computeBudgetStats(150, 100, 200).saturazionePct).toBe(150);
  });

  it("saturazione null se il budget è 0", () => {
    expect(computeBudgetStats(50, 0, 200).saturazionePct).toBeNull();
  });

  it("calcola la quota sul totale speso", () => {
    expect(computeBudgetStats(50, 100, 200).quotaPct).toBe(25);
  });

  it("quota null se il totale speso è 0", () => {
    expect(computeBudgetStats(0, 100, 0).quotaPct).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: FAIL — `Cannot find module './category-breakdown-donut.utils'`

- [ ] **Step 3: Implementa il modulo**

Crea `components/domain/expenses/category-breakdown-donut.utils.ts`:

```ts
import type { CategoryAmount } from "@/lib/calc/expenses";

const TYPE_ORDER: Record<CategoryAmount["type"], number> = { fissa: 0, variabile: 1 };

/** Ordina le categorie per tipo (fissa prima di variabile) e, dentro ogni gruppo, per importo speso decrescente. */
export function sortCategoryAmounts(categoryAmounts: CategoryAmount[]): CategoryAmount[] {
  return [...categoryAmounts].sort((a, b) => {
    if (a.type !== b.type) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    return b.amount - a.amount;
  });
}

export interface BudgetStats {
  /** Percentuale di saturazione del budget (speso / budget * 100). null se il budget è 0 (non calcolabile). */
  saturazionePct: number | null;
  /** Percentuale sul totale speso nel periodo (speso / totale * 100). null se il totale è 0 (non calcolabile). */
  quotaPct: number | null;
}

/** Calcola le percentuali di saturazione budget e quota sul totale speso per una categoria. */
export function computeBudgetStats(amount: number, budgetAmount: number, totalSpeso: number): BudgetStats {
  return {
    saturazionePct: budgetAmount > 0 ? (amount / budgetAmount) * 100 : null,
    quotaPct: totalSpeso > 0 ? (amount / totalSpeso) * 100 : null,
  };
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: PASS — 9 test verdi

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.utils.ts components/domain/expenses/category-breakdown-donut.utils.test.ts
git commit -m "feat: aggiunge ordinamento categorie e calcolo percentuali budget per la torta Spese"
```

---

### Task 3: Componente `CategoryBreakdownDonut`

**Files:**
- Create: `components/domain/expenses/category-breakdown-donut.tsx`

**Interfaces:**
- Consumes:
  - `sortCategoryAmounts`, `computeBudgetStats`, `BudgetStats` da `./category-breakdown-donut.utils` (Task 2)
  - `SWATCH_CHART_COLOR` da `@/components/domain/shared/color-swatches` (Task 1)
  - `CategoryAvatar` da `@/components/domain/categories`
  - `useUpsertBudgetMutation` da `@/lib/queries/budgets`
  - `CategoryAmount`, `FixedVsVariable` da `@/lib/calc/expenses`
  - `Budget` da `@/lib/db/schema/budgets`
  - `CategoryColor`, `CategoryIcon` da `@/lib/validation/categories`
  - `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig` da `@/components/ui/chart`
  - `Card`, `CardContent`, `CardHeader`, `CardTitle` da `@/components/ui/card`
  - `Input` da `@/components/ui/input`
  - `Badge` da `@/components/ui/badge`
  - `formatCurrency` da `@/lib/format`
- Produces: `CategoryBreakdownDonut` componente, `CategoryBreakdownDonutProps { categoryAmounts: CategoryAmount[]; fixedVsVariable: FixedVsVariable; budgets: Budget[]; currency: string }` — consumati da Task 5 (`page.tsx`) e dal barrel (Task 5).

**Nota testing:** nessun test unitario per questo file — è un componente React e il progetto non ha React Testing Library/jsdom configurati (stessa convenzione di `CategoryBreakdown`/`ExpenseCharts` esistenti, mai testati direttamente). Verifica tramite build/lint (Step 2) + verifica manuale utente finale.

- [ ] **Step 1: Crea il componente**

Crea `components/domain/expenses/category-breakdown-donut.tsx`:

```tsx
"use client";

/**
 * Blocco "Per categoria": torta multilivello (layer interno tipo fissa/variabile, layer esterno categoria) e
 * legenda con budget mensile editabile, percentuale di saturazione budget e percentuale sul totale speso nel
 * periodo. Unifica il vecchio donut "Fisse vs variabili" e la lista budget separata in un'unica card. Il
 * salvataggio del budget avviene on-blur, stessa convenzione di add-account-form.tsx.
 */

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { CategoryAvatar } from "@/components/domain/categories";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { useUpsertBudgetMutation } from "@/lib/queries/budgets";
import type { CategoryAmount, FixedVsVariable } from "@/lib/calc/expenses";
import type { Budget } from "@/lib/db/schema/budgets";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { computeBudgetStats, sortCategoryAmounts } from "./category-breakdown-donut.utils";

const TYPE_CONFIG = {
  fissa: { label: "Fisse", color: "var(--chart-1)" },
  variabile: { label: "Variabili", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Soglia di saturazione oltre la quale il badge budget passa allo stile "sopra budget". */
const BUDGET_OVER_THRESHOLD_PCT = 100;

/** Formatta il valore del tooltip (nome + importo in valuta) al posto del default numerico di ChartTooltipContent. */
function tooltipValueFormatter(currency: string) {
  return function TooltipValue(value: ValueType | undefined, name: NameType | undefined) {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-muted-foreground">{name}</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatCurrency(Number(value), currency)}
        </span>
      </div>
    );
  };
}

export interface CategoryBreakdownDonutProps {
  categoryAmounts: CategoryAmount[];
  fixedVsVariable: FixedVsVariable;
  budgets: Budget[];
  currency: string;
}

export function CategoryBreakdownDonut({
  categoryAmounts,
  fixedVsVariable,
  budgets,
  currency,
}: CategoryBreakdownDonutProps) {
  const upsertMutation = useUpsertBudgetMutation();
  const [pendingCategoryId, setPendingCategoryId] = React.useState<string | null>(null);
  const [errorCategoryId, setErrorCategoryId] = React.useState<string | null>(null);

  function budgetFor(categoryId: string): number {
    const budget = budgets.find((b) => b.categoryId === categoryId);
    return budget ? Number(budget.monthlyAmount) : 0;
  }

  /** Valida e invia il nuovo budget per una categoria. Ritorna false se il valore non è valido (nessuna mutation inviata). */
  function commitBudget(categoryId: string, raw: string): boolean {
    const normalized = raw.trim().replace(",", ".");
    const value = Number(normalized);
    if (normalized === "" || !Number.isFinite(value) || value < 0) return false;
    if (value === budgetFor(categoryId)) return true;

    setErrorCategoryId((prev) => (prev === categoryId ? null : prev));
    setPendingCategoryId(categoryId);
    upsertMutation.mutate(
      { categoryId, input: { monthlyAmount: value } },
      {
        onError: () => setErrorCategoryId(categoryId),
        onSuccess: () => setErrorCategoryId((prev) => (prev === categoryId ? null : prev)),
        onSettled: () => setPendingCategoryId((prev) => (prev === categoryId ? null : prev)),
      }
    );
    return true;
  }

  const sortedEntries = sortCategoryAmounts(categoryAmounts);
  const totalSpeso = categoryAmounts.reduce((sum, entry) => sum + entry.amount, 0);

  const innerData = [
    { key: "fissa", label: TYPE_CONFIG.fissa.label, value: fixedVsVariable.fissa, fill: "var(--color-fissa)" },
    {
      key: "variabile",
      label: TYPE_CONFIG.variabile.label,
      value: fixedVsVariable.variabile,
      fill: "var(--color-variabile)",
    },
  ];
  const outerData = sortedEntries
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      key: entry.categoryId,
      label: entry.name,
      value: entry.amount,
      fill: SWATCH_CHART_COLOR[entry.color as CategoryColor],
    }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Per categoria
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <ChartContainer config={TYPE_CONFIG} className="mx-auto aspect-square max-h-56 sm:mx-0">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            <Pie data={innerData} dataKey="value" nameKey="label" innerRadius={35} outerRadius={55}>
              {innerData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <Pie data={outerData} dataKey="value" nameKey="label" innerRadius={62} outerRadius={90}>
              {outerData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="divide-y divide-border">
          {sortedEntries.map((entry) => {
            const budgetAmount = budgetFor(entry.categoryId);
            const { saturazionePct, quotaPct } = computeBudgetStats(entry.amount, budgetAmount, totalSpeso);
            return (
              <CategoryLegendRow
                key={entry.categoryId}
                entry={entry}
                budgetAmount={budgetAmount}
                saturazionePct={saturazionePct}
                quotaPct={quotaPct}
                currency={currency}
                isSaving={pendingCategoryId === entry.categoryId}
                hasError={errorCategoryId === entry.categoryId}
                onCommitBudget={(raw) => commitBudget(entry.categoryId, raw)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface CategoryLegendRowProps {
  entry: CategoryAmount;
  budgetAmount: number;
  saturazionePct: number | null;
  quotaPct: number | null;
  currency: string;
  /** True mentre il budget di questa categoria è in salvataggio. */
  isSaving: boolean;
  /** True se l'ultimo tentativo di salvataggio per questa categoria è fallito. */
  hasError: boolean;
  /** Valida e invia il nuovo valore; ritorna false se non valido (l'input va ripristinato). */
  onCommitBudget: (raw: string) => boolean;
}

/** Riga legenda: avatar+nome categoria, importo speso, budget editabile inline, badge saturazione/quota. */
function CategoryLegendRow({
  entry,
  budgetAmount,
  saturazionePct,
  quotaPct,
  currency,
  isSaving,
  hasError,
  onCommitBudget,
}: CategoryLegendRowProps) {
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));

  React.useEffect(() => {
    setBudgetInput(String(budgetAmount));
  }, [budgetAmount]);

  function handleBlur() {
    const isValid = onCommitBudget(budgetInput);
    if (!isValid) {
      setBudgetInput(String(budgetAmount));
    }
  }

  const isOverBudget = saturazionePct !== null && saturazionePct >= BUDGET_OVER_THRESHOLD_PCT;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <CategoryAvatar
          color={entry.color as CategoryColor}
          icon={entry.icon as CategoryIcon}
          size={14}
          className="size-7"
        />
        <div>
          <p className="text-sm font-medium text-foreground">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(entry.amount, currency)} speso</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={isOverBudget ? "border-neg/40 bg-neg-soft text-neg" : ""}>
            {saturazionePct === null ? "—" : `${Math.round(saturazionePct)}% budget`}
          </Badge>
          <Badge variant="outline">{quotaPct === null ? "—" : `${Math.round(quotaPct)}% totale`}</Badge>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Budget</span>
          <Input
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            onBlur={handleBlur}
            disabled={isSaving}
            className="h-7 w-20 text-right text-sm"
            aria-label={`Budget mensile per ${entry.name}`}
          />
        </div>
        {hasError && <p className="text-sm text-destructive">Salvataggio non riuscito</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore (il file non è ancora importato da nessuna parte, ma deve essere internamente coerente).

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.tsx
git commit -m "feat: aggiunge torta multilivello con legenda budget per Spese"
```

---

### Task 4: `ExpenseTrendChart` (rinomina di `ExpenseCharts`)

**Files:**
- Create: `components/domain/expenses/expense-trend-chart.tsx`
- Delete: `components/domain/expenses/expense-charts.tsx`

**Interfaces:**
- Produces: `ExpenseTrendChart` componente, `ExpenseTrendChartProps { monthlyTrend: MonthlyTotal[]; currency: string }` — consumati da Task 5 (`page.tsx`) e dal barrel (Task 5).

**Nota testing:** nessun test unitario — stesso motivo del Task 3 (componente React, nessun harness di rendering nel progetto).

- [ ] **Step 1: Crea il nuovo file, solo bar chart**

Crea `components/domain/expenses/expense-trend-chart.tsx`:

```tsx
"use client";

/** Grafico Spese: barre "Andamento ultimi 6 mesi". */

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { MonthlyTotal } from "@/lib/calc/expenses";

const TREND_CONFIG = {
  total: { label: "Speso", color: "var(--chart-1)" },
} satisfies ChartConfig;

export interface ExpenseTrendChartProps {
  monthlyTrend: MonthlyTotal[];
  currency: string;
}

/** Formatta il valore del tooltip (nome + importo in valuta) al posto del default numerico di ChartTooltipContent. */
function tooltipValueFormatter(currency: string) {
  return function TooltipValue(value: ValueType | undefined, name: NameType | undefined) {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-muted-foreground">{name}</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatCurrency(Number(value), currency)}
        </span>
      </div>
    );
  };
}

export function ExpenseTrendChart({ monthlyTrend, currency }: ExpenseTrendChartProps) {
  const trendData = monthlyTrend.map((month) => ({ label: month.label, total: month.total }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={TREND_CONFIG} className="max-h-56 w-full">
          <BarChart data={trendData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            <Bar dataKey="total" name={TREND_CONFIG.total.label} fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Elimina il vecchio file**

```bash
git rm components/domain/expenses/expense-charts.tsx
```

- [ ] **Step 3: Verifica che il progetto compili**

Run: `pnpm exec tsc --noEmit`
Expected: errori attesi solo su `index.ts` e `page.tsx` (import ancora puntati al vecchio `expense-charts`/`category-breakdown` — risolti nel Task 5). Se compaiono altri errori inattesi, indagare prima di proseguire.

- [ ] **Step 4: Commit**

```bash
git add components/domain/expenses/expense-trend-chart.tsx
git commit -m "refactor: rinomina expense-charts in expense-trend-chart, solo bar chart"
```

---

### Task 5: Barrel, riordino pagina Spese e pulizia

**Files:**
- Modify: `components/domain/expenses/index.ts`
- Delete: `components/domain/expenses/category-breakdown.tsx`
- Modify: `app/(app)/spese/page.tsx`

**Interfaces:**
- Consumes: `CategoryBreakdownDonut`/`CategoryBreakdownDonutProps` (Task 3), `ExpenseTrendChart`/`ExpenseTrendChartProps` (Task 4).

- [ ] **Step 1: Aggiorna il barrel**

In `components/domain/expenses/index.ts`, sostituisci:

```ts
export { CategoryBreakdown } from "./category-breakdown";
export type { CategoryBreakdownProps } from "./category-breakdown";
export { ExpenseCharts } from "./expense-charts";
export type { ExpenseChartsProps } from "./expense-charts";
```

con:

```ts
export { CategoryBreakdownDonut } from "./category-breakdown-donut";
export type { CategoryBreakdownDonutProps } from "./category-breakdown-donut";
export { ExpenseTrendChart } from "./expense-trend-chart";
export type { ExpenseTrendChartProps } from "./expense-trend-chart";
```

- [ ] **Step 2: Elimina il vecchio `category-breakdown.tsx`**

```bash
git rm components/domain/expenses/category-breakdown.tsx
```

- [ ] **Step 3: Aggiorna l'import in `app/(app)/spese/page.tsx`**

Sostituisci (righe 6-13):

```ts
import {
  AddTransactionForm,
  CategoryBreakdown,
  ExpenseCharts,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  TransactionRow,
} from "@/components/domain/expenses";
```

con:

```ts
import {
  AddTransactionForm,
  CategoryBreakdownDonut,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpenseTrendChart,
  TransactionRow,
} from "@/components/domain/expenses";
```

- [ ] **Step 4: Riordina il corpo della pagina**

Sostituisci l'intero blocco JSX tra `<>` e `</>` (righe 122-176 circa, dentro l'`else` del rendering principale) con:

```tsx
        <>
          <ExpensesKpiCards
            transactions={safeTransactions}
            budgets={safeBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
          />

          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(safeTransactions, safeCategories, period, referenceDate)}
            fixedVsVariable={computeFixedVsVariable(safeTransactions, safeCategories, period, referenceDate)}
            budgets={safeBudgets}
            currency={currency}
          />

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground">
              {(() => {
                const summary = computeSummary(safeTransactions, range);
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
            monthlyTrend={compute6MonthTrend(safeTransactions, referenceDate)}
            currency={currency}
          />
        </>
```

- [ ] **Step 5: Verifica che il progetto compili, che il lint passi e che la build funzioni**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

Run: `pnpm lint`
Expected: nessun errore

Run: `pnpm build`
Expected: build completata senza errori

- [ ] **Step 6: Esegui l'intera suite di test**

Run: `pnpm test`
Expected: tutti i test passano (inclusi i nuovi 9 di `category-breakdown-donut.utils.test.ts`)

- [ ] **Step 7: Commit**

```bash
git add components/domain/expenses/index.ts "app/(app)/spese/page.tsx"
git commit -m "refactor: riordina pagina Spese, sostituisce blocco budget/donut con torta multilivello unificata"
```

---

## Verifica manuale (non automatizzabile in questa sessione)

Come per le feature precedenti in questa schermata (vedi CLAUDE.md), nessun Postgres/Redis è disponibile nel sandbox agentico: la verifica visiva finale in browser resta da fare dall'utente. Punti da controllare:
- Allineamento angolare tra layer interno (tipo) e layer esterno (categoria) della torta.
- Leggibilità della legenda su mobile (colonna impilata) e desktop (affiancata).
- Editing budget inline invariato (salvataggio on-blur, stato errore).
- Badge percentuali nei casi limite: budget a 0 (`—`), categoria a spesa zero, saturazione oltre il 100% (stile "sopra budget").
- Nuovo ordine sezioni: KPI → torta+legenda → lista transazioni → andamento 6 mesi.
