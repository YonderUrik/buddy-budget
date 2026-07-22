# Navigazione periodo in Spese — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere navigabile il periodo mostrato nella schermata Spese (frecce prev/next + menu jump-to mese/anno), per tutti e 4 i tipi di periodo (Settimana/Mese/3 mesi/Anno), senza rompere il calcolo dei KPI per periodi passati.

**Architecture:** `referenceDate` (quale periodo si guarda) e `today` (data reale, per il calcolo giorni-trascorsi) diventano due parametri distinti nelle funzioni pure di `lib/calc/expenses.ts`. Un nuovo componente `ExpensesReferenceNav` gestisce navigazione (frecce) e jump diretto (popover con griglia mese/anno), sostituendo il sottotitolo statico in `app/(app)/spese/page.tsx`.

**Tech Stack:** Next.js App Router, TypeScript, vitest, shadcn/ui (style `base-nova`, `@base-ui/react`), Tailwind CSS v4.

## Global Constraints

- Tutte le stringhe visibili in italiano.
- Nessun colore/raggio hardcoded: solo classi Tailwind sui token del tema (`text-muted-foreground`, `bg-muted`, `text-foreground`, ecc.).
- Ogni funzione pubblica in `lib/calc/expenses.ts` ha un JSDoc minimo (una riga).
- Componenti shadcn si aggiungono con `pnpm dlx shadcn@latest add <nome>` e non si modificano a mano (salvo adattamento token, non necessario qui).
- Riferimento spec: `docs/superpowers/specs/2026-07-22-spese-navigazione-periodo-design.md`.

---

### Task 1: `shiftReferenceDate` + export helper esistenti

**Files:**
- Modify: `lib/calc/expenses.ts:21-23` (esporta `startOfDay`), `lib/calc/expenses.ts:238` (esporta `MONTH_LABELS`), aggiunge `shiftReferenceDate` dopo `getPreviousPeriodRange` (dopo la riga 85)
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Produce: `export function startOfDay(date: Date): Date`, `export const MONTH_LABELS: string[]`, `export function shiftReferenceDate(period: ExpensePeriod, referenceDate: Date, direction: 1 | -1): Date` — usati dai Task 2, 4, 5.

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi in fondo a `lib/calc/expenses.test.ts` (dopo il blocco `describe("compute6MonthTrend", ...)`, prima della chiusura del file) e aggiorna l'import in cima al file aggiungendo `shiftReferenceDate`:

```ts
// nell'import esistente in cima al file, aggiungi shiftReferenceDate all'elenco:
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
  shiftReferenceDate,
} from "./expenses";
```

```ts
describe("shiftReferenceDate", () => {
  it("settimana sposta di 7 giorni avanti e indietro", () => {
    const referenceDate = new Date(2026, 6, 15);
    expect(shiftReferenceDate("settimana", referenceDate, 1)).toEqual(new Date(2026, 6, 22));
    expect(shiftReferenceDate("settimana", referenceDate, -1)).toEqual(new Date(2026, 6, 8));
  });

  it("mese sposta di un mese avanti e indietro, attraversando il cambio anno", () => {
    const referenceDate = new Date(2026, 0, 15); // gennaio 2026
    expect(shiftReferenceDate("mese", referenceDate, 1)).toEqual(new Date(2026, 1, 15));
    expect(shiftReferenceDate("mese", referenceDate, -1)).toEqual(new Date(2025, 11, 15));
  });

  it("3mesi sposta di 3 mesi avanti e indietro", () => {
    const referenceDate = new Date(2026, 5, 15); // giugno 2026
    expect(shiftReferenceDate("3mesi", referenceDate, 1)).toEqual(new Date(2026, 8, 15));
    expect(shiftReferenceDate("3mesi", referenceDate, -1)).toEqual(new Date(2026, 2, 15));
  });

  it("anno sposta di un anno avanti e indietro", () => {
    const referenceDate = new Date(2026, 5, 15);
    expect(shiftReferenceDate("anno", referenceDate, 1)).toEqual(new Date(2027, 5, 15));
    expect(shiftReferenceDate("anno", referenceDate, -1)).toEqual(new Date(2025, 5, 15));
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `shiftReferenceDate` non esportata da `./expenses`.

- [ ] **Step 3: Implementa**

In `lib/calc/expenses.ts`, cambia (riga 21):
```ts
function startOfDay(date: Date): Date {
```
in:
```ts
export function startOfDay(date: Date): Date {
```

Cambia (riga 238):
```ts
const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
```
in:
```ts
export const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
```

Aggiungi subito dopo la funzione `getPreviousPeriodRange` (dopo la riga 85, prima di `function isWithinRange`):
```ts
/** Sposta referenceDate di un'unità di periodo (avanti se direction=1, indietro se direction=-1). */
export function shiftReferenceDate(period: ExpensePeriod, referenceDate: Date, direction: 1 | -1): Date {
  switch (period) {
    case "settimana":
      return addDays(referenceDate, 7 * direction);
    case "mese":
      return addMonths(referenceDate, 1 * direction);
    case "3mesi":
      return addMonths(referenceDate, 3 * direction);
    case "anno":
      return new Date(referenceDate.getFullYear() + direction, referenceDate.getMonth(), referenceDate.getDate());
  }
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS, tutti i test incluso il nuovo blocco `shiftReferenceDate`.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiunge shiftReferenceDate per navigare i periodi in Spese"
```

---

### Task 2: `formatPeriodLabel`

**Files:**
- Modify: `lib/calc/expenses.ts` (aggiunge funzione dopo `shiftReferenceDate`)
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consuma: `DateRange`, `ExpensePeriod` (già esistenti in `lib/calc/expenses.ts`)
- Produce: `export function formatPeriodLabel(period: ExpensePeriod, range: DateRange): string` — usata dal Task 4 (`ExpensesReferenceNav`) e da `page.tsx`.

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi `formatPeriodLabel` all'import in cima a `lib/calc/expenses.test.ts` (stesso import modificato al Task 1), poi aggiungi in fondo al file:

```ts
describe("formatPeriodLabel", () => {
  it("mese: nome mese esteso capitalizzato + anno", () => {
    const range = getPeriodRange("mese", new Date(2026, 6, 15));
    expect(formatPeriodLabel("mese", range)).toBe("Luglio 2026");
  });

  it("anno: solo l'anno", () => {
    const range = getPeriodRange("anno", new Date(2026, 6, 15));
    expect(formatPeriodLabel("anno", range)).toBe("2026");
  });

  it("settimana: giorno-giorno mese abbreviato, stesso anno, senza spazi attorno al trattino", () => {
    const range = getPeriodRange("settimana", new Date(2026, 6, 15));
    expect(formatPeriodLabel("settimana", range)).toBe("13–19 lug");
  });

  it("settimana: entrambe le date complete a cavallo d'anno", () => {
    const range = { from: new Date(2026, 11, 28), to: new Date(2027, 0, 3) };
    expect(formatPeriodLabel("settimana", range)).toBe("28 dic 2026 – 3 gen 2027");
  });

  it("3mesi: mese abbreviato - mese abbreviato + anno, stesso anno", () => {
    const range = getPeriodRange("3mesi", new Date(2026, 6, 15));
    expect(formatPeriodLabel("3mesi", range)).toBe("Mag – Lug 2026");
  });

  it("3mesi: entrambi i mesi con anno, a cavallo d'anno", () => {
    const range = getPeriodRange("3mesi", new Date(2026, 0, 15));
    expect(formatPeriodLabel("3mesi", range)).toBe("Nov 2025 – Gen 2026");
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL — `formatPeriodLabel` non esportata da `./expenses`.

- [ ] **Step 3: Implementa**

Aggiungi in `lib/calc/expenses.ts`, subito dopo `shiftReferenceDate`:

```ts
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Etichetta leggibile del periodo mostrato in Spese, formattata secondo il tipo (mese/settimana/3mesi/anno). */
export function formatPeriodLabel(period: ExpensePeriod, range: DateRange): string {
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  switch (period) {
    case "mese": {
      const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(range.from);
      return `${capitalize(monthName)} ${range.from.getFullYear()}`;
    }
    case "anno":
      return `${range.from.getFullYear()}`;
    case "settimana": {
      if (sameYear) {
        const day = new Intl.DateTimeFormat("it-IT", { day: "numeric" }).format(range.from);
        const dayMonth = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(range.to);
        return `${day}–${dayMonth}`;
      }
      const fullFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
      return `${fullFormat.format(range.from)} – ${fullFormat.format(range.to)}`;
    }
    case "3mesi": {
      const monthYearFormat = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });
      if (sameYear) {
        const monthOnly = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(range.from);
        return `${capitalize(monthOnly)} – ${capitalize(monthYearFormat.format(range.to))}`;
      }
      return `${capitalize(monthYearFormat.format(range.from))} – ${capitalize(monthYearFormat.format(range.to))}`;
    }
  }
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS, tutti i test incluso il nuovo blocco `formatPeriodLabel`.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiunge formatPeriodLabel per l'etichetta periodo in Spese"
```

---

### Task 3: separare `referenceDate` (vista) da `today` (oggi reale) in `computeKpis`/`computeCategoryBreakdown`/`computeFixedVsVariable`

**Files:**
- Modify: `lib/calc/expenses.ts:148-173` (`computeKpis`), `lib/calc/expenses.ts:185-207` (`computeCategoryBreakdown`), `lib/calc/expenses.ts:215-229` (`computeFixedVsVariable`)
- Modify: `components/domain/expenses/expenses-kpi-cards.tsx` (aggiunge prop `today`)
- Modify: `app/(app)/spese/page.tsx` (aggiunge `today`, aggiorna le chiamate)
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consuma: `startOfDay` (esportata al Task 1)
- Produce: nuove firme `computeKpis(transactions, budgets, period, referenceDate, today)`, `computeCategoryBreakdown(transactions, categories, period, referenceDate, today)`, `computeFixedVsVariable(transactions, categories, period, referenceDate, today)` — usate da Task 4/5 (indirettamente, tramite `page.tsx`) e da qualunque chiamante futuro.

- [ ] **Step 1: Aggiorna i test esistenti (li rendi falliti dalla firma nuova) e aggiungi il caso "periodo passato"**

In `lib/calc/expenses.test.ts`, sostituisci la chiamata nel blocco `describe("computeKpis", ...)`:

```ts
    const kpis = computeKpis(transactions, budgets, "mese", referenceDate);
```
con:
```ts
    const kpis = computeKpis(transactions, budgets, "mese", referenceDate, referenceDate);
```

Sostituisci la chiamata nel blocco `describe("computeCategoryBreakdown", ...)`:
```ts
    const breakdown = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15));
```
con:
```ts
    const breakdown = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
```

Sostituisci la chiamata nel blocco `describe("computeFixedVsVariable", ...)`:
```ts
    const result = computeFixedVsVariable(transactions, categories, "mese", new Date(2026, 1, 15));
```
con:
```ts
    const result = computeFixedVsVariable(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
```

Aggiungi un nuovo test nel blocco `describe("computeKpis", ...)`, dopo il test esistente:

```ts
  it("un periodo passato (mese concluso) conta tutti i giorni come trascorsi, indipendentemente da 'oggi'", () => {
    const referenceDate = new Date(2026, 1, 15); // vista: metà febbraio 2026
    const today = new Date(2026, 3, 10); // oggi reale: aprile 2026, febbraio è già concluso
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "-100.00" }),
      makeTransaction({ date: "2026-02-28", amount: "-180.00" }), // fine mese: futuro rispetto a referenceDate, passato rispetto a today
    ];
    const budgets = [makeBudget({ monthlyAmount: "280.00" })];

    const kpis = computeKpis(transactions, budgets, "mese", referenceDate, today);

    expect(kpis.speso).toBe(280);
    expect(kpis.giorniRimasti).toBe(0);
    expect(kpis.mediaGiornaliera).toBeCloseTo(280 / 28, 5);
  });
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL — troppi argomenti passati a funzioni con firma vecchia (errore TypeScript) o, se TS non blocca subito vitest, il nuovo test sul periodo passato fallisce perché `computeKpis` interpreta ancora `referenceDate` come "oggi".

- [ ] **Step 3: Implementa**

In `lib/calc/expenses.ts`, sostituisci l'intera funzione `computeKpis` (righe 148-173) con:

```ts
/**
 * KPI principali di Spese per il periodo selezionato. "Speso" e "Media giornaliera" contano solo i
 * giorni del periodo già trascorsi rispetto a `today` (la data reale corrente); "Budget rimanente"/
 * "giorni rimasti" guardano invece all'intero periodo calendariale (anche i giorni futuri).
 * `referenceDate` è il periodo che si sta guardando (può essere passato o presente, mai futuro);
 * `today` è sempre la data reale, indipendente da quale periodo si sta navigando.
 */
export function computeKpis(
  transactions: Transaction[],
  budgets: Budget[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): ExpensesKpis {
  const range = getPeriodRange(period, referenceDate);
  const todayStart = startOfDay(today);
  const clampedToday = todayStart.getTime() < range.from.getTime() ? range.from : todayStart;
  const elapsedRange: DateRange = {
    from: range.from,
    to: clampedToday.getTime() < range.to.getTime() ? clampedToday : range.to,
  };

  const { speseEffettive: speso } = computeSummary(transactions, elapsedRange);

  const budgetTotale = scaleBudgetForPeriod(totalMonthlyBudget(budgets), period);
  const budgetRimanente = budgetTotale - speso;
  const giorniRimasti = Math.max(0, daysBetween(todayStart, range.to));

  const elapsedDays = Math.max(1, daysBetween(range.from, elapsedRange.to) + 1);
  const mediaGiornaliera = speso / elapsedDays;

  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const { speseEffettive: prevSpeso } = computeSummary(transactions, previousRange);
  const previousDays = Math.max(1, daysBetween(previousRange.from, previousRange.to) + 1);
  const mediaGiornalieraPeriodoPrecedente = prevSpeso / previousDays;

  return { speso, budgetTotale, budgetRimanente, giorniRimasti, mediaGiornaliera, mediaGiornalieraPeriodoPrecedente };
}
```

Sostituisci l'intera funzione `computeCategoryBreakdown` (righe 185-207) con:

```ts
/** Spesa effettiva per categoria nel periodo selezionato, una riga per ogni categoria dell'utente. */
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

  return categories.map((category) => {
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

Sostituisci l'intera funzione `computeFixedVsVariable` (righe 215-229) con:

```ts
/** Somma spesa effettiva del periodo, raggruppata per tipo categoria (fissa/variabile). */
export function computeFixedVsVariable(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): FixedVsVariable {
  const breakdown = computeCategoryBreakdown(transactions, categories, period, referenceDate, today);
  return breakdown.reduce(
    (totals, entry) => {
      totals[entry.type] += entry.amount;
      return totals;
    },
    { fissa: 0, variabile: 0 }
  );
}
```

Ora aggiorna `components/domain/expenses/expenses-kpi-cards.tsx`: sostituisci l'intero file con:

```tsx
/** Riga di KPI per la schermata Spese: Speso nel periodo, Budget rimanente, Media giornaliera. */

import { StatCard } from "@/components/domain/stat-card";
import { computeKpis, type ExpensePeriod } from "@/lib/calc/expenses";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";

export interface ExpensesKpiCardsProps {
  transactions: Transaction[];
  budgets: Budget[];
  period: ExpensePeriod;
  currency: string;
  /** Periodo che l'utente sta guardando (può essere passato o presente). */
  referenceDate: Date;
  /** Data reale corrente, per il taglio giorni-trascorsi — indipendente da referenceDate. */
  today: Date;
}

export function ExpensesKpiCards({
  transactions,
  budgets,
  period,
  currency,
  referenceDate,
  today,
}: ExpensesKpiCardsProps) {
  const kpis = computeKpis(transactions, budgets, period, referenceDate, today);
  const trendLabel =
    kpis.mediaGiornaliera <= kpis.mediaGiornalieraPeriodoPrecedente
      ? "In calo rispetto al periodo precedente"
      : "In aumento rispetto al periodo precedente";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Speso nel periodo" value={-kpis.speso} currency={currency} />
      <StatCard
        label="Budget rimanente"
        value={kpis.budgetRimanente}
        currency={currency}
        subtitle={`${kpis.giorniRimasti} giorni rimasti`}
      />
      <StatCard
        label="Media giornaliera"
        value={-kpis.mediaGiornaliera}
        currency={currency}
        subtitle={trendLabel}
      />
    </div>
  );
}
```

(Nota: `referenceDate` era opzionale con default `new Date()` — ora è obbligatoria, coerente con `today` obbligatoria: nessun default silenzioso su un valore concettualmente critico.)

Infine, in `app/(app)/spese/page.tsx`:

Sostituisci (riga 43):
```tsx
  const referenceDate = React.useMemo(() => new Date(), []);
```
con:
```tsx
  const referenceDate = React.useMemo(() => new Date(), []);
  const today = React.useMemo(() => new Date(), []);
```

(la conversione di `referenceDate` a stato navigabile avviene nel Task 4; qui resta costante ma `today` viene introdotta come concetto separato, già collegata ai chiamanti)

Sostituisci (righe 131-136):
```tsx
          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(safeTransactions, safeCategories, period, referenceDate)}
            fixedVsVariable={computeFixedVsVariable(safeTransactions, safeCategories, period, referenceDate)}
            budgets={safeBudgets}
            currency={currency}
          />
```
con:
```tsx
          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(safeTransactions, safeCategories, period, referenceDate, today)}
            fixedVsVariable={computeFixedVsVariable(safeTransactions, safeCategories, period, referenceDate, today)}
            budgets={safeBudgets}
            currency={currency}
          />
```

Sostituisci (righe 123-129):
```tsx
          <ExpensesKpiCards
            transactions={safeTransactions}
            budgets={safeBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
          />
```
con:
```tsx
          <ExpensesKpiCards
            transactions={safeTransactions}
            budgets={safeBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
            today={today}
          />
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS, tutti i test incluso il nuovo test "periodo passato".

Run anche: `pnpm exec tsc --noEmit`
Expected: nessun errore di tipo (nessun chiamante rimasto con la firma vecchia).

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts components/domain/expenses/expenses-kpi-cards.tsx "app/(app)/spese/page.tsx"
git commit -m "fix: separa referenceDate (vista) da today (oggi reale) nei calcoli KPI di Spese"
```

---

### Task 4: `ExpensesReferenceNav` (frecce prev/next) e navigazione in `page.tsx`

**Files:**
- Create: `components/domain/expenses/expenses-reference-nav.tsx`
- Test: `components/domain/expenses/expenses-reference-nav.tsx` non ha test dedicati (componente UI, non logica pura) — verificato tramite `pnpm exec tsc --noEmit` e build; la logica pura sottostante (`shiftReferenceDate`, `formatPeriodLabel`) è già testata nei Task 1-2
- Modify: `components/domain/expenses/index.ts` (barrel)
- Modify: `app/(app)/spese/page.tsx` (referenceDate diventa stato, sostituisce il sottotitolo)

**Interfaces:**
- Consuma: `formatPeriodLabel`, `getPeriodRange`, `shiftReferenceDate`, `startOfDay` (Task 1/2), `ExpensePeriod`
- Produce: `ExpensesReferenceNav` con props `{ period: ExpensePeriod; referenceDate: Date; onChange: (newReferenceDate: Date) => void }` — esteso dal Task 5 con il popover, non cambia la firma.

- [ ] **Step 1: Crea il componente**

Crea `components/domain/expenses/expenses-reference-nav.tsx`:

```tsx
"use client";

/** Frecce prev/next per navigare il periodo mostrato in Spese, con l'etichetta del periodo attivo. */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftReferenceDate,
  startOfDay,
  type ExpensePeriod,
} from "@/lib/calc/expenses";

export interface ExpensesReferenceNavProps {
  period: ExpensePeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}

export function ExpensesReferenceNav({ period, referenceDate, onChange }: ExpensesReferenceNavProps) {
  const range = getPeriodRange(period, referenceDate);
  const today = startOfDay(new Date());
  const isNextDisabled = range.to.getTime() >= today.getTime();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <span className="min-w-[9rem] text-center text-sm text-muted-foreground">
        {formatPeriodLabel(period, range)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, 1))}
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

- [ ] **Step 2: Aggiungi al barrel**

In `components/domain/expenses/index.ts`, aggiungi dopo la riga `export type { ExpensesPeriodSelectorProps } from "./expenses-period-selector";`:

```ts
export { ExpensesReferenceNav } from "./expenses-reference-nav";
export type { ExpensesReferenceNavProps } from "./expenses-reference-nav";
```

- [ ] **Step 3: Verifica di compilazione**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore (il componente non è ancora usato da nessuna pagina, ma deve compilare da solo).

- [ ] **Step 4: Wire in `page.tsx`**

In `app/(app)/spese/page.tsx`, aggiungi `ExpensesReferenceNav` all'import esistente da `@/components/domain/expenses` (ordine alfabetico):

```tsx
import {
  AddTransactionForm,
  CategoryBreakdownDonut,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpensesReferenceNav,
  ExpenseTrendChart,
  TransactionRow,
} from "@/components/domain/expenses";
```

Sostituisci (dal Task 3):
```tsx
  const referenceDate = React.useMemo(() => new Date(), []);
  const today = React.useMemo(() => new Date(), []);
```
con:
```tsx
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const today = React.useMemo(() => new Date(), []);
```

Sostituisci il blocco titolo+sottotitolo:
```tsx
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Spese</h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(range.from)} –{" "}
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(range.to)}
          </p>
        </div>
```
con:
```tsx
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Spese</h1>
          <ExpensesReferenceNav period={period} referenceDate={referenceDate} onChange={setReferenceDate} />
        </div>
```

- [ ] **Step 5: Verifica di compilazione e build**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

Run: `pnpm build`
Expected: build completata senza errori.

- [ ] **Step 6: Commit**

```bash
git add components/domain/expenses/expenses-reference-nav.tsx components/domain/expenses/index.ts "app/(app)/spese/page.tsx"
git commit -m "feat: aggiunge navigazione prev/next del periodo in Spese"
```

---

### Task 5: menu jump-to mese/anno (popover)

**Files:**
- Create (via CLI): `components/ui/popover.tsx`
- Modify: `components/domain/expenses/expenses-reference-nav.tsx` (sostituzione completa)

**Interfaces:**
- Consuma: `MONTH_LABELS` (Task 1), primitive `Popover`/`PopoverTrigger`/`PopoverContent` generate dalla CLI shadcn
- Produce: nessuna nuova interfaccia pubblica — `ExpensesReferenceNavProps` invariata rispetto al Task 4.

- [ ] **Step 1: Aggiungi il primitive popover**

Run: `pnpm dlx shadcn@latest add popover`
Expected: crea `components/ui/popover.tsx`.

Poi leggi il file generato (`components/ui/popover.tsx`) e conferma che esporta `Popover`, `PopoverTrigger`, `PopoverContent` (stesso pattern di `Dialog`/`DialogTrigger`/`DialogContent` in `components/ui/dialog.tsx`: `PopoverContent` include già `Portal`/`Positioner` internamente, quindi si usa direttamente senza wrapper aggiuntivi). Se i nomi generati differiscono, adatta gli import nello Step 2 di conseguenza.

- [ ] **Step 2: Sostituisci `expenses-reference-nav.tsx` con la versione che include il popover**

Sostituisci l'intero contenuto di `components/domain/expenses/expenses-reference-nav.tsx` con:

```tsx
"use client";

/**
 * Navigazione del periodo mostrato in Spese: frecce prev/next + click sull'etichetta per aprire
 * un menu di salto diretto a un mese/anno specifico (griglia mesi, anni futuri/mesi futuri disabilitati).
 */

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftReferenceDate,
  startOfDay,
  MONTH_LABELS,
  type ExpensePeriod,
} from "@/lib/calc/expenses";

export interface ExpensesReferenceNavProps {
  period: ExpensePeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}

export function ExpensesReferenceNav({ period, referenceDate, onChange }: ExpensesReferenceNavProps) {
  const [open, setOpen] = React.useState(false);
  const [gridYear, setGridYear] = React.useState(referenceDate.getFullYear());
  const today = startOfDay(new Date());
  const range = getPeriodRange(period, referenceDate);
  const isNextDisabled = range.to.getTime() >= today.getTime();
  const isFutureGridYear = gridYear >= today.getFullYear();

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setGridYear(referenceDate.getFullYear());
    }
    setOpen(nextOpen);
  }

  function pickMonth(month: number) {
    onChange(new Date(gridYear, month, 1));
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </button>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          className="min-w-[9rem] rounded-md px-2 py-1 text-center text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {formatPeriodLabel(period, range)}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setGridYear((y) => y - 1)}
              aria-label="Anno precedente"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <span className="font-heading text-sm font-medium text-foreground">{gridYear}</span>
            <button
              type="button"
              onClick={() => setGridYear((y) => y + 1)}
              disabled={isFutureGridYear}
              aria-label="Anno successivo"
              className={cn(
                "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                isFutureGridYear && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
              )}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_LABELS.map((label, month) => {
              const isFutureMonth =
                gridYear > today.getFullYear() || (gridYear === today.getFullYear() && month > today.getMonth());
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pickMonth(month)}
                  disabled={isFutureMonth}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted",
                    isFutureMonth && "cursor-not-allowed opacity-40 hover:bg-transparent"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, 1))}
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

- [ ] **Step 3: Verifica di compilazione e build**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore. Se `PopoverTrigger`/`PopoverContent` non accettano `className`/`children` come scritto sopra, correggi in base alle props effettive generate da shadcn (verificate nello Step 1).

Run: `pnpm build`
Expected: build completata senza errori.

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: PASS (nessuna funzione pura toccata in questo task).

- [ ] **Step 4: Commit**

```bash
git add components/ui/popover.tsx components/domain/expenses/expenses-reference-nav.tsx
git commit -m "feat: aggiunge menu jump-to mese/anno alla navigazione periodo in Spese"
```

---

## Verifica manuale (fuori scope dei task automatizzati)

Nessun Postgres/Redis disponibile in questo ambiente per un browser reale (come per le feature precedenti di Spese). Dopo l'esecuzione dei 5 task, l'utente deve verificare manualmente:
- Frecce prev/next cambiano il periodo mostrato per tutti e 4 i tipi (Settimana/Mese/3 mesi/Anno).
- Freccia "next" disabilitata quando si è già nel periodo corrente.
- Click sull'etichetta apre il popover; mesi/anni futuri disabilitati; selezionare un mese passato aggiorna KPI/grafici/lista transazioni coerentemente.
- KPI corretti su un mese passato (giorni rimasti = 0, media giornaliera calcolata sull'intero mese, non troncata a "oggi").
