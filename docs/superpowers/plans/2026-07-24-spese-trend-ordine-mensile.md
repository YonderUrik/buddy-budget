# Andamento 6 mesi: ricalcolo top/ordine mensile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nello stacked bar "Andamento ultimi 6 mesi" (Spese), sia la selezione delle categorie "top" sia l'ordine di impilamento (incluso il segmento "Altro") vengono ricalcolati indipendentemente per ciascun mese, in base all'importo di quel mese, invece di un ranking fisso sull'intero semestre.

**Architecture:** `computeCategoryMonthlyTrend` in `lib/calc/expenses.ts` viene sostituita da `computeCategoryMonthlyStacks`, che per ogni mese produce un array `segments` già ordinato per importo decrescente (categorie individuali + eventuale "Altro" riordinato insieme, non fisso in coda). `ExpenseTrendChart` viene riscritto per un rendering "a slot posizionali" (un `<Bar>` recharts per posizione nello stack, colore per singolo mese via `<Cell>`) dato che recharts condivide l'ordine di stacking tra tutte le barre di un `BarChart` in base all'ordine di dichiarazione dei componenti `<Bar>` — non esiste un ordine nativo per-mese con un `<Bar>` per categoria. Tooltip custom (non il `formatter` di `ChartTooltipContent`, pensato per nomi di serie fissi) legge i segmenti reali del mese sotto hover direttamente dalla riga dati.

**Tech Stack:** Next.js/TypeScript, recharts 3.8 (via `ChartContainer`/`Bar`/`BarChart`/`Cell`/`Tooltip` di shadcn), vitest.

## Global Constraints

- Nessun colore/valore hardcoded nei componenti: usare sempre i token tema (`SWATCH_CHART_COLOR`, `var(--muted-foreground)`), mai hex letterali.
- JSDoc minimo su funzioni/componenti pubblici (una riga).
- Tutte le stringhe visibili all'utente in italiano ("Altro", ecc.).
- `compute6MonthTrend` esistente NON va rimossa né modificata.
- Il segmento con l'importo più alto di un mese va alla **base** della barra (primo `<Bar>` dichiarato = base dello stack in recharts).
- **Nessuna legenda fissa** sotto al grafico: l'identificazione della categoria avviene solo via tooltip.

---

### Task 1: `computeCategoryMonthlyStacks` in `lib/calc/expenses.ts`

**Files:**
- Modify: `lib/calc/expenses.ts:325-409` (sostituisce interamente `MonthlyCategoryTotal`/`CategoryTrendSeries`/`CategoryMonthlyTrend`/`computeCategoryMonthlyTrend`, introdotte nel piano precedente su questo stesso branch)
- Test: `lib/calc/expenses.test.ts:14` (import), `lib/calc/expenses.test.ts:245-303` (sostituisce il blocco `describe("computeCategoryMonthlyTrend", ...)`)

**Interfaces:**
- Consumes: `Transaction`, `Category` (già importati in `expenses.ts`), `computeSummary(transactions, range): ExpensesSummary`, `MONTH_LABELS: string[]`, `addMonths`/`startOfMonth`/`endOfMonth` (funzioni interne già presenti nel file, usate da `compute6MonthTrend`).
- Produces:
  ```ts
  export interface MonthlyStackSegment {
    key: string;
    name: string;
    color: string;
    amount: number;
  }
  export interface MonthlyCategoryStack {
    year: number;
    month: number;
    label: string;
    segments: MonthlyStackSegment[];
  }
  export function computeCategoryMonthlyStacks(
    transactions: Transaction[],
    categories: Category[],
    referenceDate: Date,
    topCount?: number
  ): MonthlyCategoryStack[]
  ```
  Usati da Task 2 (`ExpenseTrendChart`, `app/(app)/spese/page.tsx`).

- [ ] **Step 1: Aggiorna l'import nel test file**

In `lib/calc/expenses.test.ts`, riga 14, sostituisci:

```ts
  computeCategoryMonthlyTrend,
```

con:

```ts
  computeCategoryMonthlyStacks,
```

- [ ] **Step 2: Sostituisci il blocco di test**

In `lib/calc/expenses.test.ts`, sostituisci l'intero blocco da riga 245 (`describe("computeCategoryMonthlyTrend", () => {`) a riga 303 (il `});` che lo chiude) con:

```ts
describe("computeCategoryMonthlyStacks", () => {
  it("ricalcola composizione e ordine in modo indipendente per ogni mese (non un ranking fisso sul totale semestre)", () => {
    const referenceDate = new Date(2026, 6, 15); // luglio 2026
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-300.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-05", amount: "-250.00" }),
      makeTransaction({ categoryId: "cat-c", date: "2026-07-06", amount: "-100.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate, 2);

    expect(months).toHaveLength(6);

    const feb = months.find((m) => m.month === 1);
    expect(feb?.segments).toEqual([{ key: "cat-a", name: "A", color: "blue", amount: 300 }]);

    const jul = months.find((m) => m.month === 6);
    expect(jul?.segments).toEqual([
      { key: "cat-b", name: "B", color: "green", amount: 250 },
      { key: "cat-c", name: "C", color: "red", amount: 100 },
    ]);
  });

  it("riordina 'Altro' insieme alle categorie individuali: se il suo totale supera una categoria top, si posiziona di conseguenza (non fisso in coda)", () => {
    const referenceDate = new Date(2026, 6, 15);
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
      makeCategory({ id: "cat-d", name: "D", color: "yellow" }),
      makeCategory({ id: "cat-e", name: "E", color: "purple" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-07-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-05", amount: "-50.00" }),
      makeTransaction({ categoryId: "cat-c", date: "2026-07-05", amount: "-40.00" }),
      makeTransaction({ categoryId: "cat-d", date: "2026-07-05", amount: "-35.00" }),
      makeTransaction({ categoryId: "cat-e", date: "2026-07-05", amount: "-20.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate, 2);
    const jul = months.find((m) => m.month === 6);

    // top individuali: cat-a (100), cat-b (50). Resto: cat-c+cat-d+cat-e = 95 -> "Altro" si piazza tra cat-a e cat-b.
    expect(jul?.segments).toEqual([
      { key: "cat-a", name: "A", color: "blue", amount: 100 },
      { key: "altro", name: "Altro", color: "altro", amount: 95 },
      { key: "cat-b", name: "B", color: "green", amount: 50 },
    ]);
  });

  it("con meno categorie attive del topCount, l'array segments è più corto e non contiene chiavi fantasma", () => {
    const referenceDate = new Date(2026, 6, 15);
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-07-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-06", amount: "-50.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate);
    const jul = months.find((m) => m.month === 6);

    expect(jul?.segments).toEqual([
      { key: "cat-a", name: "A", color: "blue", amount: 100 },
      { key: "cat-b", name: "B", color: "green", amount: 50 },
    ]);
  });

  it("con nessuna categoria o transazione ritorna 6 mesi con segments vuoto", () => {
    const referenceDate = new Date(2026, 6, 15);
    const months = computeCategoryMonthlyStacks([], [], referenceDate);

    expect(months).toHaveLength(6);
    expect(months.every((m) => m.segments.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 3: Esegui i test e verifica che falliscano**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `computeCategoryMonthlyStacks` non è esportata da `./expenses` (errore di import/undefined), oltre a eventuali errori residui per riferimenti rimasti a `computeCategoryMonthlyTrend` se lo Step 4 non è ancora stato fatto.

- [ ] **Step 4: Sostituisci l'implementazione**

In `lib/calc/expenses.ts`, sostituisci l'intero blocco da riga 325 (`export interface MonthlyCategoryTotal {`) a riga 409 (il `}` che chiude `computeCategoryMonthlyTrend`) con:

```ts
export interface MonthlyStackSegment {
  key: string;
  name: string;
  color: string;
  amount: number;
}

export interface MonthlyCategoryStack {
  year: number;
  month: number;
  label: string;
  segments: MonthlyStackSegment[];
}

const OTHER_STACK_SEGMENT_KEY = "altro";

/**
 * Spesa effettiva per categoria sugli ultimi 6 mesi calendariali, con le top `topCount` categorie
 * e un eventuale segmento "Altro" ricalcolati indipendentemente per ciascun mese (non un ranking
 * fisso sul totale semestre): la stessa categoria può occupare posizioni diverse, o finire dentro
 * "Altro", da un mese all'altro. "Altro" è riordinato insieme alle categorie individuali per
 * importo, non è fisso in coda.
 */
export function computeCategoryMonthlyStacks(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): MonthlyCategoryStack[] {
  const months: MonthlyCategoryStack[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = addMonths(referenceDate, -i);
    const range: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };

    const categoryAmounts = categories
      .map((category) => {
        const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
        const amount = computeSummary(categoryTransactions, range).speseEffettive;
        return { category, amount };
      })
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const topEntries = categoryAmounts.slice(0, topCount);
    const restEntries = categoryAmounts.slice(topCount);

    const segments: MonthlyStackSegment[] = topEntries.map((entry) => ({
      key: entry.category.id,
      name: entry.category.name,
      color: entry.category.color,
      amount: entry.amount,
    }));

    const otherAmount = restEntries.reduce((sum, entry) => sum + entry.amount, 0);
    if (otherAmount > 0) {
      segments.push({
        key: OTHER_STACK_SEGMENT_KEY,
        name: "Altro",
        color: OTHER_STACK_SEGMENT_KEY,
        amount: otherAmount,
      });
    }

    segments.sort((a, b) => b.amount - a.amount);

    months.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      segments,
    });
  }

  return months;
}
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: PASS — tutti i test in `expenses.test.ts`, incluso il nuovo blocco `computeCategoryMonthlyStacks`. Nessuna regressione sugli altri blocchi (in particolare `compute6MonthTrend`, invariato).

- [ ] **Step 6: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: ricalcola top/ordine mensile in computeCategoryMonthlyStacks"
```

---

### Task 2: Rendering a slot posizionali in `ExpenseTrendChart` + integrazione pagina Spese

**Files:**
- Modify: `components/domain/expenses/expense-trend-chart.tsx` (riscrittura completa, era 81 righe)
- Modify: `app/(app)/spese/page.tsx:20` (import), `:199-202` (uso componente)

**Interfaces:**
- Consumes: `computeCategoryMonthlyStacks`, `MonthlyCategoryStack`, `MonthlyStackSegment` da Task 1 (`lib/calc/expenses.ts`); `SWATCH_CHART_COLOR: Record<SwatchColor, string>` da `components/domain/shared/color-swatches.ts`; `CategoryColor` da `lib/validation/categories.ts` (alias di `SwatchColor`); `formatCurrency(amount: number, currency: string): string` da `lib/format.ts`.
- Produces: `ExpenseTrendChart({ monthlyStacks, currency })` — sostituisce la prop `monthlyCategoryTrend: CategoryMonthlyTrend` con `monthlyStacks: MonthlyCategoryStack[]`. Unico consumer: `app/(app)/spese/page.tsx` (già confermato nel piano precedente su questo branch, nessun altro file importa `ExpenseTrendChartProps`).

- [ ] **Step 1: Riscrivi `components/domain/expenses/expense-trend-chart.tsx`**

Sostituisci l'intero contenuto del file con:

```tsx
"use client";

/** Grafico Spese: barre impilate "Andamento ultimi 6 mesi", segmenti per categoria ricalcolati mese per mese (top 6 + eventuale "Altro", ordine per importo di quel mese specifico). */

import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { MonthlyCategoryStack, MonthlyStackSegment } from "@/lib/calc/expenses";
import type { CategoryColor } from "@/lib/validation/categories";

/** Colore fisso (non uno swatch) per il segmento aggregato "Altro", per non confondersi con una categoria reale. */
const OTHER_SEGMENT_COLOR = "var(--muted-foreground)";

export interface ExpenseTrendChartProps {
  monthlyStacks: MonthlyCategoryStack[];
  currency: string;
}

interface MonthlyStackRow {
  label: string;
  segments: MonthlyStackSegment[];
  [slotAmountKey: string]: unknown;
}

function segmentColor(segment: MonthlyStackSegment): string {
  return segment.key === "altro" ? OTHER_SEGMENT_COLOR : SWATCH_CHART_COLOR[segment.color as CategoryColor];
}

/** Trasforma i mesi in righe dati recharts con uno slot posizionale (`posNAmount`) per ciascuna posizione dello stack, fino a `maxSlots`. */
function buildRows(months: MonthlyCategoryStack[], maxSlots: number): MonthlyStackRow[] {
  return months.map((month) => {
    const row: MonthlyStackRow = { label: month.label, segments: month.segments };
    for (let i = 0; i < maxSlots; i++) {
      row[`pos${i}Amount`] = month.segments[i]?.amount;
    }
    return row;
  });
}

interface MonthlyStackTooltipProps extends TooltipProps<number, string> {
  currency: string;
}

/** Tooltip custom: legge i segmenti reali del mese sotto hover dalla riga dati (`payload[0].payload.segments`), perché nome/colore per slot cambiano ogni mese e il `formatter` di `ChartTooltipContent` assume un nome fisso per serie. */
function MonthlyStackTooltip({ active, payload, currency }: MonthlyStackTooltipProps) {
  const row = payload?.[0]?.payload as MonthlyStackRow | undefined;
  if (!active || !row || row.segments.length === 0) return null;

  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {row.segments.map((segment) => (
        <div key={segment.key} className="flex w-full items-center justify-between gap-3">
          <span className="text-muted-foreground">{segment.name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatCurrency(segment.amount, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ExpenseTrendChart({ monthlyStacks, currency }: ExpenseTrendChartProps) {
  const maxSlots = monthlyStacks.reduce((max, month) => Math.max(max, month.segments.length), 0);
  const rows = buildRows(monthlyStacks, maxSlots);
  const slots = Array.from({ length: maxSlots }, (_, i) => i);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="max-h-56 w-full">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<MonthlyStackTooltip currency={currency} />} />
            {slots.map((slotIndex) => (
              <Bar key={slotIndex} dataKey={`pos${slotIndex}Amount`} stackId="trend">
                {rows.map((row, rowIndex) => {
                  const segment = row.segments[slotIndex];
                  return <Cell key={rowIndex} fill={segment ? segmentColor(segment) : "transparent"} />;
                })}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Aggiorna `app/(app)/spese/page.tsx`**

Riga 20, sostituisci l'import:

```ts
  computeCategoryMonthlyTrend,
```

con:

```ts
  computeCategoryMonthlyStacks,
```

Righe 199-202, sostituisci la chiamata al componente:

```tsx
          <ExpenseTrendChart
            monthlyStacks={computeCategoryMonthlyStacks(filteredTransactions, safeCategories, referenceDate)}
            currency={currency}
          />
```

- [ ] **Step 3: Verifica build e lint**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore TypeScript (in particolare nessun riferimento residuo a `computeCategoryMonthlyTrend`/`CategoryMonthlyTrend`/`monthlyCategoryTrend` in `expense-trend-chart.tsx` o `page.tsx`). Nota: `pnpm build` in questo sandbox richiede `DATABASE_URL` (nessun Postgres disponibile) — `tsc --noEmit` è la verifica di tipo equivalente senza bisogno del DB, coerente con la nota già presente in CLAUDE.md.

Run: `pnpm lint`
Expected: nessun nuovo errore introdotto (il debito tecnico preesistente di 2 errori `react-hooks/set-state-in-effect` in `components/theme-toggle.tsx` e `category-breakdown-donut.tsx`, non toccati da questo task, può restare).

- [ ] **Step 4: Esegui l'intera suite di test puri**

Run: `pnpm vitest run lib/`
Expected: PASS su tutti i file — nessuna regressione nei test esistenti (`expenses.test.ts` con i nuovi test di Task 1, `distribute-colors.test.ts`, `split-slider.utils.test.ts`, `category-breakdown-donut.utils.test.ts`, ecc.). I test di integrazione DB (`lib/db/integration.test.ts`, `lib/gocardless/*.test.ts`) falliscono per assenza di Postgres in questo sandbox — limite ambientale noto, non una regressione di questo task.

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/expense-trend-chart.tsx "app/(app)/spese/page.tsx"
git commit -m "feat: rendering a slot posizionali per ordine stack mensile in Andamento 6 mesi"
```

---

## Verifica manuale (fuori dai task, da fare dall'utente)

Nessun Postgres/Redis disponibile nel sandbox agentico per un test in browser reale. Da verificare manualmente:
- Passando da un mese all'altro, l'ordine dei segmenti nella barra cambia coerentemente con gli importi di quel mese (il più grande sempre alla base).
- Un mese in cui "Altro" supera una categoria "top": il segmento "Altro" (grigio) appare più in basso nello stack di quella categoria, non sempre in cima.
- Un mese con poche categorie attive: barra visibilmente più bassa, nessun segmento vuoto/fantasma.
- Nessuna legenda fissa sotto al grafico; il tooltip al hover su una barra mostra solo i segmenti realmente presenti quel mese, con nome e importo corretti.
- Nessuna categoria con spesa nel semestre (o filtro categoria che azzera tutto): barre vuote, nessun errore console.
