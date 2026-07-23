# Andamento 6 mesi: stacked bar per categoria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il grafico "Andamento ultimi 6 mesi" in Spese mostra uno stacked bar per categoria (top 6 + "Altro") invece di una barra a colore singolo con solo il totale.

**Architecture:** Nuova funzione pura `computeCategoryMonthlyTrend` in `lib/calc/expenses.ts` (stesso schema di `compute6MonthTrend`, non modificata) che calcola, per ciascuno dei 6 mesi calendariali, la spesa effettiva per le top 6 categorie (per spesa totale sul semestre) più un aggregato "Altro" per il resto. `ExpenseTrendChart` viene riscritto per renderizzare un `<Bar>` recharts per serie con `stackId` comune, colori dalla palette condivisa (`SWATCH_CHART_COLOR`), tooltip e legenda propria coerenti col resto della UI di Spese.

**Tech Stack:** Next.js/TypeScript, recharts (via componente `ChartContainer`/`Bar`/`BarChart` di shadcn), vitest.

## Global Constraints

- Nessun colore/valore hardcoded nei componenti: usare sempre i token tema (`SWATCH_CHART_COLOR`, `var(--muted-foreground)`), mai hex letterali.
- JSDoc minimo su funzioni/componenti pubblici (una riga).
- Tutte le stringhe visibili all'utente in italiano ("Altro", ecc.).
- `compute6MonthTrend` esistente NON va rimosso né modificato.

---

### Task 1: `computeCategoryMonthlyTrend` in `lib/calc/expenses.ts`

**Files:**
- Modify: `lib/calc/expenses.ts` (aggiungere dopo `compute6MonthTrend`, circa riga 323)
- Test: `lib/calc/expenses.test.ts` (aggiungere dopo il blocco `describe("compute6MonthTrend", ...)`, circa riga 242)

**Interfaces:**
- Consumes: `Transaction`, `Category` (già importati in `expenses.ts`), `computeSummary(transactions, range): ExpensesSummary`, `MONTH_LABELS`, `addMonths`/`startOfMonth`/`endOfMonth` (funzioni interne già presenti nel file).
- Produces:
  ```ts
  export interface MonthlyCategoryTotal {
    year: number;
    month: number;
    label: string;
    amounts: Record<string, number>;
  }
  export interface CategoryTrendSeries {
    key: string;
    name: string;
    color: string;
  }
  export interface CategoryMonthlyTrend {
    months: MonthlyCategoryTotal[];
    series: CategoryTrendSeries[];
  }
  export function computeCategoryMonthlyTrend(
    transactions: Transaction[],
    categories: Category[],
    referenceDate: Date,
    topCount?: number
  ): CategoryMonthlyTrend
  ```
  Usati da Task 2 (`ExpenseTrendChart`, `app/(app)/spese/page.tsx`).

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi in `lib/calc/expenses.test.ts`, subito dopo il blocco `describe("compute6MonthTrend", ...)` (riga 242 circa). Aggiorna anche l'import in cima al file per includere `computeCategoryMonthlyTrend`:

```ts
import {
  computeKpis,
  computeSummary,
  effectiveAmount,
  getPeriodRange,
  getPreviousPeriodRange,
  isExpense,
  parseDateOnly,
  scaleBudgetForPeriod,
  computeCategoryBreakdown,
  computeFixedVsVariable,
  compute6MonthTrend,
  computeCategoryMonthlyTrend,
  filterTransactions,
  shiftReferenceDate,
  formatPeriodLabel,
} from "./expenses";
```

Nuovo blocco di test:

```ts
describe("computeCategoryMonthlyTrend", () => {
  it("assegna alle top `topCount` categorie una serie propria, ordinate per spesa totale semestre discendente, e aggrega il resto in 'altro'", () => {
    const referenceDate = new Date(2026, 6, 15); // luglio 2026
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-300.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-05", amount: "-200.00" }),
      makeTransaction({ categoryId: "cat-c", date: "2026-07-06", amount: "-50.00" }),
    ];

    const trend = computeCategoryMonthlyTrend(transactions, categories, referenceDate, 2);

    expect(trend.series).toEqual([
      { key: "cat-a", name: "A", color: "blue" },
      { key: "cat-b", name: "B", color: "green" },
      { key: "altro", name: "Altro", color: "altro" },
    ]);
    expect(trend.months).toHaveLength(6);

    const feb = trend.months.find((m) => m.month === 1);
    expect(feb?.amounts).toEqual({ "cat-a": 300, "cat-b": 0, altro: 0 });

    const jul = trend.months.find((m) => m.month === 6);
    expect(jul?.amounts).toEqual({ "cat-a": 0, "cat-b": 200, altro: 50 });
  });

  it("omette la serie 'altro' quando non ci sono categorie oltre le top N con spesa positiva", () => {
    const referenceDate = new Date(2026, 6, 15);
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-07-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-06", amount: "-50.00" }),
    ];

    const trend = computeCategoryMonthlyTrend(transactions, categories, referenceDate);

    expect(trend.series).toEqual([
      { key: "cat-a", name: "A", color: "blue" },
      { key: "cat-b", name: "B", color: "green" },
    ]);
    expect(trend.months.every((m) => !("altro" in m.amounts))).toBe(true);
  });

  it("con nessuna categoria ritorna 6 mesi vuoti e nessuna serie", () => {
    const referenceDate = new Date(2026, 6, 15);
    const trend = computeCategoryMonthlyTrend([], [], referenceDate);

    expect(trend.series).toEqual([]);
    expect(trend.months).toHaveLength(6);
    expect(trend.months.every((m) => Object.keys(m.amounts).length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `computeCategoryMonthlyTrend` non è esportata da `./expenses` (errore di import/undefined).

- [ ] **Step 3: Implementa `computeCategoryMonthlyTrend`**

Aggiungi in `lib/calc/expenses.ts`, subito dopo la chiusura della funzione `compute6MonthTrend` (dopo la riga 323 `}`):

```ts
export interface MonthlyCategoryTotal {
  year: number;
  month: number;
  label: string;
  amounts: Record<string, number>;
}

export interface CategoryTrendSeries {
  key: string;
  name: string;
  color: string;
}

export interface CategoryMonthlyTrend {
  months: MonthlyCategoryTotal[];
  series: CategoryTrendSeries[];
}

const OTHER_TREND_SERIES_KEY = "altro";

/**
 * Spesa effettiva per categoria sugli ultimi 6 mesi calendariali, con le top `topCount` categorie
 * (per spesa totale sul semestre) come serie proprie e il resto aggregato in una serie "Altro".
 * Il ranking è calcolato una sola volta sull'intero semestre, cosà che ogni categoria mantenga
 * sempre lo stesso segmento/colore da un mese all'altro.
 */
export function computeCategoryMonthlyTrend(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): CategoryMonthlyTrend {
  const monthRanges: { year: number; month: number; label: string; range: DateRange }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = addMonths(referenceDate, -i);
    monthRanges.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      range: { from: startOfMonth(monthDate), to: endOfMonth(monthDate) },
    });
  }

  const perMonthByCategory = new Map<string, number[]>();
  const totalByCategory = new Map<string, number>();

  categories.forEach((category) => {
    const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
    const perMonth = monthRanges.map((m) => computeSummary(categoryTransactions, m.range).speseEffettive);
    perMonthByCategory.set(category.id, perMonth);
    totalByCategory.set(category.id, perMonth.reduce((sum, v) => sum + v, 0));
  });

  const rankedCategories = [...categories].sort(
    (a, b) => (totalByCategory.get(b.id) ?? 0) - (totalByCategory.get(a.id) ?? 0)
  );
  const topCategories = rankedCategories.slice(0, topCount);
  const restCategories = rankedCategories.slice(topCount);
  const hasOther = restCategories.some((category) => (totalByCategory.get(category.id) ?? 0) > 0);

  const series: CategoryTrendSeries[] = topCategories.map((category) => ({
    key: category.id,
    name: category.name,
    color: category.color,
  }));
  if (hasOther) {
    series.push({ key: OTHER_TREND_SERIES_KEY, name: "Altro", color: OTHER_TREND_SERIES_KEY });
  }

  const months: MonthlyCategoryTotal[] = monthRanges.map((m, index) => {
    const amounts: Record<string, number> = {};
    topCategories.forEach((category) => {
      amounts[category.id] = perMonthByCategory.get(category.id)?.[index] ?? 0;
    });
    if (hasOther) {
      amounts[OTHER_TREND_SERIES_KEY] = restCategories.reduce(
        (sum, category) => sum + (perMonthByCategory.get(category.id)?.[index] ?? 0),
        0
      );
    }
    return { year: m.year, month: m.month, label: m.label, amounts };
  });

  return { months, series };
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: PASS — tutti i test in `expenses.test.ts`, incluso il nuovo blocco `computeCategoryMonthlyTrend`.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiungi computeCategoryMonthlyTrend per stacked bar per categoria"
```

---

### Task 2: Stacked bar in `ExpenseTrendChart` + integrazione pagina Spese

**Files:**
- Modify: `components/domain/expenses/expense-trend-chart.tsx` (riscrittura completa, era 58 righe)
- Modify: `app/(app)/spese/page.tsx:18-26` (import), `:199-202` (uso componente)

**Interfaces:**
- Consumes: `computeCategoryMonthlyTrend` e i tipi `CategoryMonthlyTrend`/`CategoryTrendSeries`/`MonthlyCategoryTotal` da Task 1 (`lib/calc/expenses.ts`); `SWATCH_CHART_COLOR: Record<SwatchColor, string>` da `components/domain/shared/color-swatches.ts`; `CategoryColor` da `lib/validation/categories.ts` (alias di `SwatchColor`).
- Produces: `ExpenseTrendChart({ monthlyCategoryTrend, currency })` — sostituisce la prop `monthlyTrend: MonthlyTotal[]` con `monthlyCategoryTrend: CategoryMonthlyTrend`. Nessun altro file consuma `ExpenseTrendChartProps` oltre a `app/(app)/spese/page.tsx`.

- [ ] **Step 1: Riscrivi `components/domain/expenses/expense-trend-chart.tsx`**

Sostituisci l'intero contenuto del file con:

```tsx
"use client";

/** Grafico Spese: barre impilate "Andamento ultimi 6 mesi", un segmento per categoria (top 6 + eventuale "Altro"). */

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { CategoryMonthlyTrend, CategoryTrendSeries } from "@/lib/calc/expenses";
import type { CategoryColor } from "@/lib/validation/categories";

/** Colore fisso (non uno swatch) per la serie aggregata "Altro", per non confondersi con una categoria reale. */
const OTHER_SERIES_COLOR = "var(--muted-foreground)";

export interface ExpenseTrendChartProps {
  monthlyCategoryTrend: CategoryMonthlyTrend;
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

function seriesColor(series: CategoryTrendSeries): string {
  return series.key === "altro" ? OTHER_SERIES_COLOR : SWATCH_CHART_COLOR[series.color as CategoryColor];
}

export function ExpenseTrendChart({ monthlyCategoryTrend, currency }: ExpenseTrendChartProps) {
  const { months, series } = monthlyCategoryTrend;
  const trendData = months.map((month) => ({ label: month.label, ...month.amounts }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  const chartConfig = series.reduce<ChartConfig>((config, entry) => {
    config[entry.key] = { label: entry.name, color: seriesColor(entry) };
    return config;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="max-h-56 w-full">
          <BarChart data={trendData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            {series.map((entry) => (
              <Bar key={entry.key} dataKey={entry.key} name={entry.name} stackId="trend" fill={seriesColor(entry)} />
            ))}
          </BarChart>
        </ChartContainer>
        {series.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {series.map((entry) => (
              <div key={entry.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: seriesColor(entry) }} />
                {entry.name}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Aggiorna `app/(app)/spese/page.tsx`**

In cima al file (righe 18-26), sostituisci l'import di `compute6MonthTrend` con `computeCategoryMonthlyTrend`:

```ts
import {
  computeCategoryBreakdown,
  computeCategoryMonthlyTrend,
  computeFixedVsVariable,
  computeSummary,
  filterTransactions,
  getPeriodRange,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
```

Alla fine del file (righe 199-202), sostituisci la chiamata al componente:

```tsx
          <ExpenseTrendChart
            monthlyCategoryTrend={computeCategoryMonthlyTrend(filteredTransactions, safeCategories, referenceDate)}
            currency={currency}
          />
```

- [ ] **Step 3: Verifica build e lint**

Run: `pnpm build`
Expected: build completata senza errori TypeScript (in particolare nessun riferimento residuo a `compute6MonthTrend`/`monthlyTrend` in `expense-trend-chart.tsx` o `page.tsx`).

Run: `pnpm lint`
Expected: nessun nuovo errore introdotto (il debito tecnico preesistente di 2 errori `react-hooks/set-state-in-effect`, non toccato da questo task, può restare).

- [ ] **Step 4: Esegui l'intera suite di test**

Run: `pnpm vitest run`
Expected: PASS — nessuna regressione nei test esistenti (`expenses.test.ts`, `distribute-colors.test.ts`, `split-slider.utils.test.ts`, `category-breakdown-donut.utils.test.ts`, ecc.).

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/expense-trend-chart.tsx "app/(app)/spese/page.tsx"
git commit -m "feat: stacked bar per categoria in Andamento 6 mesi (Spese)"
```

---

## Verifica manuale (fuori dai task, da fare dall'utente)

Come per le feature precedenti su Spese/Categorie, nessun Postgres/Redis è disponibile nel sandbox agentico per un test in browser reale. Da verificare manualmente:
- Con più di 6 categorie con spesa nel semestre: il segmento "Altro" appare, colore grigio distinguibile dalle categorie reali.
- Con 6 o meno categorie con spesa: nessun segmento "Altro", nessuna voce "Altro" in legenda.
- Tooltip al hover su una barra mensile mostra tutte le serie di quel mese con l'importo corretto in valuta.
- Legenda sotto al grafico elenca le stesse serie del chart, con lo stesso ordine e colore.
