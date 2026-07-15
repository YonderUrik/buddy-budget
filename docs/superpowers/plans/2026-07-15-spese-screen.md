# Schermata Spese Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare la schermata Spese end-to-end (KPI, grafici, categorie con budget, lista transazioni con editing/dividi/elimina, form di aggiunta), sostituendo lo screen "non ancora implementato" con una versione reale e funzionante, coerente con `docs/functional-spec.md` sezione 3.

**Architecture:** Un motore di calcolo puro (`lib/calc/expenses.ts`) centralizza periodo/KPI/categorie/grafici a partire da una lista di transazioni già filtrata lato client (fetch di una finestra di 13 mesi via `GET /api/transactions?from&to`), seguendo lo stesso pattern Route Handlers + Zod + TanStack Query + ownership check già usato in Conti (`app/api/accounts/`, `lib/queries/accounts.ts`, `components/domain/accounts/`).

**Tech Stack:** Next.js App Router, Drizzle ORM (schema già esistente), Zod, TanStack Query, shadcn/ui (nuovi componenti `slider` e `chart` da installare), Recharts, Vitest.

## Global Constraints

- Tutte le stringhe visibili sono in italiano (nessuna i18n ancora).
- Nessun colore/raggio hardcoded nei componenti: solo token Tailwind del tema.
- JSDoc minimo (una riga `/**`) su ogni componente/funzione pubblica.
- Barrel file `index.ts` in `components/domain/expenses/` — chi importa da fuori usa sempre quello.
- Route in `app/` senza logica di business: solo orchestrazione.
- Pattern API: `auth.api.getSession({ headers })` → 401 se assente; Zod `safeParse` → 400 su errore; helper di ownership `getOwned*` → 404 se non proprio.
- I test API sono di integrazione contro Postgres reale (vedi `vitest.config.ts`, `fileParallelism: false`): stesso pattern di `app/api/accounts/route.test.ts` (crea `authUser` di test in `beforeEach`, elimina in `afterEach`, `client.end()` in `afterAll`).
- Riuso deciso: `parseAmount` resta in `lib/validation/accounts.ts` (già generico, non specifico ai conti) — i nuovi moduli lo re-importano da lì invece di duplicarlo.
- Convenzione segno importo: `transactions.amount` negativo = uscita reale, positivo = entrata. Spese filtra e calcola **solo** `amount < 0`; le entrate restano nella tabella ma invisibili qui (serviranno a una futura schermata Cash flow).
- Categorie mostrate in "Per categoria": **tutte** quelle dell'utente (query reale, non un array hardcoded delle 8 nominate nello spec) — include quindi anche "Da categorizzare" se ha importi.

---

### Task 1: Motore di calcolo — intervalli periodo e KPI

**Files:**
- Create: `lib/calc/expenses.ts`
- Test: `lib/calc/expenses.test.ts`

**Interfaces:**
- Produce: `ExpensePeriod = "settimana" | "mese" | "3mesi" | "anno"`, `DateRange { from: Date; to: Date }`, `parseDateOnly(dateStr: string): Date`, `getPeriodRange(period, referenceDate): DateRange`, `getPreviousPeriodRange(period, referenceDate): DateRange`, `isExpense(transaction: Transaction): boolean`, `effectiveAmount(transaction: Transaction): number`, `ExpensesSummary { uscite: number; escluse: number; speseEffettive: number }`, `computeSummary(transactions, range): ExpensesSummary`, `scaleBudgetForPeriod(monthlyTotal: number, period: ExpensePeriod): number`, `ExpensesKpis { speso; budgetTotale; budgetRimanente; giorniRimasti; mediaGiornaliera; mediaGiornalieraPeriodoPrecedente }`, `computeKpis(transactions, budgets, period, referenceDate): ExpensesKpis`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/calc/expenses.test.ts
import { describe, expect, it } from "vitest";
import {
  computeKpis,
  computeSummary,
  effectiveAmount,
  getPeriodRange,
  getPreviousPeriodRange,
  isExpense,
  parseDateOnly,
  scaleBudgetForPeriod,
} from "./expenses";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";

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

function makeBudget(overrides: Partial<Budget>): Budget {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    categoryId: "category-1",
    monthlyAmount: "0.00",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("parseDateOnly", () => {
  it("costruisce una data locale senza slittamenti di fuso orario", () => {
    const date = parseDateOnly("2026-02-10");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(10);
  });
});

describe("getPeriodRange", () => {
  it("mese copre dal primo all'ultimo giorno del mese", () => {
    const range = getPeriodRange("mese", new Date(2026, 1, 10));
    expect(range.from).toEqual(new Date(2026, 1, 1));
    expect(range.to).toEqual(new Date(2026, 1, 28));
  });

  it("anno copre dal 1 gennaio al 31 dicembre", () => {
    const range = getPeriodRange("anno", new Date(2026, 5, 1));
    expect(range.from).toEqual(new Date(2026, 0, 1));
    expect(range.to).toEqual(new Date(2026, 11, 31));
  });

  it("3mesi copre 3 mesi calendariali fino a quello corrente incluso", () => {
    const range = getPeriodRange("3mesi", new Date(2026, 5, 15));
    expect(range.from).toEqual(new Date(2026, 3, 1));
    expect(range.to).toEqual(new Date(2026, 5, 30));
  });

  it("settimana copre esattamente 7 giorni a partire da un lunedì e contiene referenceDate", () => {
    const referenceDate = new Date(2026, 6, 15);
    const range = getPeriodRange("settimana", referenceDate);
    const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86400000);
    expect(spanDays).toBe(6);
    expect(range.from.getDay()).toBe(1);
    expect(referenceDate.getTime()).toBeGreaterThanOrEqual(range.from.getTime());
    expect(referenceDate.getTime()).toBeLessThanOrEqual(range.to.getTime());
  });
});

describe("getPreviousPeriodRange", () => {
  it("mese precedente è il mese calendariale immediatamente prima", () => {
    const range = getPreviousPeriodRange("mese", new Date(2026, 1, 10));
    expect(range.from).toEqual(new Date(2026, 0, 1));
    expect(range.to).toEqual(new Date(2026, 0, 31));
  });

  it("anno precedente è l'anno solare immediatamente prima", () => {
    const range = getPreviousPeriodRange("anno", new Date(2026, 5, 1));
    expect(range.from).toEqual(new Date(2025, 0, 1));
    expect(range.to).toEqual(new Date(2025, 11, 31));
  });
});

describe("isExpense / effectiveAmount", () => {
  it("considera spesa solo un importo negativo", () => {
    expect(isExpense(makeTransaction({ amount: "-50.00" }))).toBe(true);
    expect(isExpense(makeTransaction({ amount: "50.00" }))).toBe(false);
  });

  it("calcola la spesa effettiva sottraendo la quota esclusa", () => {
    const transaction = makeTransaction({ amount: "-100.00", excludedAmount: "-30.00" });
    expect(effectiveAmount(transaction)).toBe(-70);
  });
});

describe("computeSummary", () => {
  it("somma Uscite/Escluse/Spese effettive ignorando le entrate", () => {
    const range = { from: new Date(2026, 1, 1), to: new Date(2026, 1, 28) };
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "-100.00", excludedAmount: "-40.00" }),
      makeTransaction({ date: "2026-02-10", amount: "-50.00" }),
      makeTransaction({ date: "2026-02-15", amount: "200.00" }),
    ];
    const summary = computeSummary(transactions, range);
    expect(summary.uscite).toBe(150);
    expect(summary.escluse).toBe(40);
    expect(summary.speseEffettive).toBe(110);
  });
});

describe("scaleBudgetForPeriod", () => {
  it("scala il budget mensile in base al periodo", () => {
    expect(scaleBudgetForPeriod(300, "settimana")).toBeCloseTo(70, 5);
    expect(scaleBudgetForPeriod(300, "mese")).toBe(300);
    expect(scaleBudgetForPeriod(300, "3mesi")).toBe(900);
    expect(scaleBudgetForPeriod(300, "anno")).toBe(3600);
  });
});

describe("computeKpis", () => {
  it("calcola Speso/Budget rimanente/giorni rimasti/media giornaliera per il mese in corso", () => {
    const referenceDate = new Date(2026, 1, 15);
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "-300.00" }),
      makeTransaction({ date: "2026-02-10", amount: "-100.00" }),
      makeTransaction({ date: "2026-02-20", amount: "-50.00" }), // futuro rispetto a referenceDate
      makeTransaction({ date: "2026-01-15", amount: "-310.00" }), // mese precedente
    ];
    const budgets = [makeBudget({ monthlyAmount: "700.00" })];

    const kpis = computeKpis(transactions, budgets, "mese", referenceDate);

    expect(kpis.speso).toBe(400);
    expect(kpis.budgetTotale).toBe(700);
    expect(kpis.budgetRimanente).toBe(300);
    expect(kpis.giorniRimasti).toBe(13);
    expect(kpis.mediaGiornaliera).toBeCloseTo(400 / 15, 5);
    expect(kpis.mediaGiornalieraPeriodoPrecedente).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: FAIL con "Cannot find module './expenses'" o simile

- [ ] **Step 3: Implement `lib/calc/expenses.ts`**

```typescript
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";

/** Periodo selezionabile nella schermata Spese. */
export type ExpensePeriod = "settimana" | "mese" | "3mesi" | "anno";

export interface DateRange {
  from: Date;
  to: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Costruisce una Date locale (mezzanotte) da una stringa "YYYY-MM-DD", senza slittamenti di fuso orario. */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfISOWeek(date: Date): Date {
  const day = date.getDay(); // 0 = domenica
  const diffToMonday = day === 0 ? 6 : day - 1;
  return addDays(startOfDay(date), -diffToMonday);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** Intervallo calendariale del periodo selezionato, contenente referenceDate. */
export function getPeriodRange(period: ExpensePeriod, referenceDate: Date): DateRange {
  switch (period) {
    case "settimana": {
      const from = startOfISOWeek(referenceDate);
      return { from, to: addDays(from, 6) };
    }
    case "mese":
      return { from: startOfMonth(referenceDate), to: endOfMonth(referenceDate) };
    case "3mesi":
      return { from: startOfMonth(addMonths(referenceDate, -2)), to: endOfMonth(referenceDate) };
    case "anno":
      return { from: new Date(referenceDate.getFullYear(), 0, 1), to: new Date(referenceDate.getFullYear(), 11, 31) };
  }
}

/** Intervallo, di uguale lunghezza calendariale, immediatamente precedente al periodo selezionato. */
export function getPreviousPeriodRange(period: ExpensePeriod, referenceDate: Date): DateRange {
  let shiftedReference: Date;
  switch (period) {
    case "settimana":
      shiftedReference = addDays(referenceDate, -7);
      break;
    case "mese":
      shiftedReference = addMonths(referenceDate, -1);
      break;
    case "3mesi":
      shiftedReference = addMonths(referenceDate, -3);
      break;
    case "anno":
      shiftedReference = new Date(referenceDate.getFullYear() - 1, referenceDate.getMonth(), referenceDate.getDate());
      break;
  }
  return getPeriodRange(period, shiftedReference);
}

function isWithinRange(date: Date, range: DateRange): boolean {
  const day = startOfDay(date);
  return day.getTime() >= range.from.getTime() && day.getTime() <= range.to.getTime();
}

/** Transazione di spesa reale (uscita bancaria): importo negativo. Le entrate non fanno parte di Spese. */
export function isExpense(transaction: Transaction): boolean {
  return Number(transaction.amount) < 0;
}

/** Importo (negativo) della spesa effettiva dopo "Dividi": amount - excludedAmount. */
export function effectiveAmount(transaction: Transaction): number {
  return Number(transaction.amount) - Number(transaction.excludedAmount);
}

export interface ExpensesSummary {
  uscite: number;
  escluse: number;
  speseEffettive: number;
}

/** Somma Uscite / Escluse / Spese effettive (valori positivi) per le transazioni di spesa nell'intervallo. */
export function computeSummary(transactions: Transaction[], range: DateRange): ExpensesSummary {
  const inRange = transactions.filter((t) => isExpense(t) && isWithinRange(parseDateOnly(t.date), range));
  const uscite = inRange.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const escluse = inRange.reduce((sum, t) => sum + Math.abs(Number(t.excludedAmount)), 0);
  return { uscite, escluse, speseEffettive: uscite - escluse };
}

function totalMonthlyBudget(budgets: Budget[]): number {
  return budgets.reduce((sum, b) => sum + Number(b.monthlyAmount), 0);
}

/** Scala un budget mensile totale sulla lunghezza del periodo selezionato. */
export function scaleBudgetForPeriod(monthlyTotal: number, period: ExpensePeriod): number {
  switch (period) {
    case "settimana":
      return (monthlyTotal / 30) * 7;
    case "mese":
      return monthlyTotal;
    case "3mesi":
      return monthlyTotal * 3;
    case "anno":
      return monthlyTotal * 12;
  }
}

export interface ExpensesKpis {
  speso: number;
  budgetTotale: number;
  budgetRimanente: number;
  giorniRimasti: number;
  mediaGiornaliera: number;
  mediaGiornalieraPeriodoPrecedente: number;
}

/**
 * KPI principali di Spese per il periodo selezionato. "Speso" e "Media giornaliera" contano solo i
 * giorni del periodo già trascorsi (fino a referenceDate incluso); "Budget rimanente"/"giorni rimasti"
 * guardano invece all'intero periodo calendariale (anche i giorni futuri).
 */
export function computeKpis(
  transactions: Transaction[],
  budgets: Budget[],
  period: ExpensePeriod,
  referenceDate: Date
): ExpensesKpis {
  const range = getPeriodRange(period, referenceDate);
  const today = startOfDay(referenceDate);
  const elapsedRange: DateRange = { from: range.from, to: today.getTime() < range.to.getTime() ? today : range.to };

  const { speseEffettive: speso } = computeSummary(transactions, elapsedRange);

  const budgetTotale = scaleBudgetForPeriod(totalMonthlyBudget(budgets), period);
  const budgetRimanente = budgetTotale - speso;
  const giorniRimasti = Math.max(0, daysBetween(today, range.to));

  const elapsedDays = Math.max(1, daysBetween(range.from, elapsedRange.to) + 1);
  const mediaGiornaliera = speso / elapsedDays;

  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const { speseEffettive: prevSpeso } = computeSummary(transactions, previousRange);
  const previousDays = Math.max(1, daysBetween(previousRange.from, previousRange.to) + 1);
  const mediaGiornalieraPeriodoPrecedente = prevSpeso / previousDays;

  return { speso, budgetTotale, budgetRimanente, giorniRimasti, mediaGiornaliera, mediaGiornalieraPeriodoPrecedente };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: PASS (tutti i test verdi)

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: motore di calcolo periodo e KPI per Spese"
```

---

### Task 2: Motore di calcolo — categorie, fisse/variabili, andamento 6 mesi

**Files:**
- Modify: `lib/calc/expenses.ts` (append)
- Test: `lib/calc/expenses.test.ts` (append)

**Interfaces:**
- Consuma: `ExpensePeriod`, `DateRange`, `parseDateOnly`, `isExpense`, `effectiveAmount`, `computeSummary` (Task 1)
- Produce: `CategoryAmount { categoryId: string; name: string; type: "fissa" | "variabile"; amount: number }`, `computeCategoryBreakdown(transactions, categories, period, referenceDate): CategoryAmount[]`, `FixedVsVariable { fissa: number; variabile: number }`, `computeFixedVsVariable(transactions, categories, period, referenceDate): FixedVsVariable`, `MonthlyTotal { year: number; month: number; label: string; total: number }`, `compute6MonthTrend(transactions, referenceDate): MonthlyTotal[]`

- [ ] **Step 1: Write the failing tests**

Aggiungere in fondo a `lib/calc/expenses.test.ts` (aggiornare anche gli import in cima al file per includere le nuove funzioni):

```typescript
// aggiungere agli import esistenti in lib/calc/expenses.test.ts:
// computeCategoryBreakdown, computeFixedVsVariable, compute6MonthTrend
import type { Category } from "@/lib/db/schema/categories";

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "category-1",
    userId: "user-1",
    name: "Categoria",
    type: "variabile",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("computeCategoryBreakdown", () => {
  it("somma la spesa effettiva per ciascuna categoria dell'utente, incluse quelle senza transazioni", () => {
    const categories = [
      makeCategory({ id: "cat-a", name: "Spesa alimentare", type: "variabile" }),
      makeCategory({ id: "cat-b", name: "Affitto", type: "fissa" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-60.00" }),
      makeTransaction({ categoryId: "cat-a", date: "2026-02-06", amount: "-40.00", excludedAmount: "-10.00" }),
    ];
    const breakdown = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15));

    expect(breakdown).toEqual([
      { categoryId: "cat-a", name: "Spesa alimentare", type: "variabile", amount: 90 },
      { categoryId: "cat-b", name: "Affitto", type: "fissa", amount: 0 },
    ]);
  });
});

describe("computeFixedVsVariable", () => {
  it("raggruppa la spesa effettiva del periodo per tipo categoria", () => {
    const categories = [
      makeCategory({ id: "cat-a", type: "variabile" }),
      makeCategory({ id: "cat-b", type: "fissa" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-60.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-02-06", amount: "-500.00" }),
    ];
    const result = computeFixedVsVariable(transactions, categories, "mese", new Date(2026, 1, 15));
    expect(result).toEqual({ fissa: 500, variabile: 60 });
  });
});

describe("compute6MonthTrend", () => {
  it("ritorna 6 mesi calendariali fino a quello corrente, ignorando dati fuori finestra", () => {
    const referenceDate = new Date(2026, 6, 15); // luglio 2026
    const transactions = [
      makeTransaction({ date: "2026-01-10", amount: "-999.00" }), // fuori finestra (gennaio)
      makeTransaction({ date: "2026-02-10", amount: "-100.00" }),
      makeTransaction({ date: "2026-07-05", amount: "-50.00" }),
    ];
    const trend = compute6MonthTrend(transactions, referenceDate);

    expect(trend).toHaveLength(6);
    expect(trend[0]).toEqual({ year: 2026, month: 1, label: "Feb", total: 100 });
    expect(trend[5]).toEqual({ year: 2026, month: 6, label: "Lug", total: 50 });
    expect(trend.reduce((sum, m) => sum + m.total, 0)).toBe(150);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: FAIL con "computeCategoryBreakdown is not defined" o simile

- [ ] **Step 3: Append to `lib/calc/expenses.ts`**

```typescript
// aggiungere l'import Category in cima al file:
// import type { Category } from "@/lib/db/schema/categories";

export interface CategoryAmount {
  categoryId: string;
  name: string;
  type: "fissa" | "variabile";
  amount: number;
}

/** Spesa effettiva per categoria nel periodo selezionato, una riga per ogni categoria dell'utente. */
export function computeCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date
): CategoryAmount[] {
  const range = getPeriodRange(period, referenceDate);
  const today = startOfDay(referenceDate);
  const elapsedRange: DateRange = { from: range.from, to: today.getTime() < range.to.getTime() ? today : range.to };

  const inRange = transactions.filter((t) => isExpense(t) && isWithinRange(parseDateOnly(t.date), elapsedRange));

  return categories.map((category) => ({
    categoryId: category.id,
    name: category.name,
    type: category.type,
    amount: inRange
      .filter((t) => t.categoryId === category.id)
      .reduce((sum, t) => sum + Math.abs(effectiveAmount(t)), 0),
  }));
}

export interface FixedVsVariable {
  fissa: number;
  variabile: number;
}

/** Somma spesa effettiva del periodo, raggruppata per tipo categoria (fissa/variabile). */
export function computeFixedVsVariable(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date
): FixedVsVariable {
  const breakdown = computeCategoryBreakdown(transactions, categories, period, referenceDate);
  return breakdown.reduce(
    (totals, entry) => {
      totals[entry.type] += entry.amount;
      return totals;
    },
    { fissa: 0, variabile: 0 }
  );
}

export interface MonthlyTotal {
  year: number;
  month: number;
  label: string;
  total: number;
}

const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

/** Spesa effettiva totale per ciascuno degli ultimi 6 mesi calendariali (incluso quello corrente), indipendente dal periodo selezionato. */
export function compute6MonthTrend(transactions: Transaction[], referenceDate: Date): MonthlyTotal[] {
  const months: MonthlyTotal[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = addMonths(referenceDate, -i);
    const range: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };
    const { speseEffettive } = computeSummary(transactions, range);
    months.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      total: speseEffettive,
    });
  }
  return months;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiunge breakdown categorie, fisse/variabili e andamento 6 mesi al motore Spese"
```

---

### Task 3: Validazione — transazioni

**Files:**
- Create: `lib/validation/transactions.ts`
- Test: `lib/validation/transactions.test.ts`

**Interfaces:**
- Consuma: `parseAmount` da `lib/validation/accounts.ts` (esistente, riesportato)
- Produce: `createTransactionSchema`, `CreateTransactionInput`, `updateTransactionSchema`, `UpdateTransactionInput`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/validation/transactions.test.ts
import { describe, expect, it } from "vitest";
import { createTransactionSchema, updateTransactionSchema } from "./transactions";

describe("createTransactionSchema", () => {
  it("accetta un input valido", () => {
    const result = createTransactionSchema.safeParse({
      accountId: crypto.randomUUID(),
      description: "Spesa alimentare",
      categoryId: crypto.randomUUID(),
      amount: 42.5,
      date: "2026-02-10",
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta un importo non positivo", () => {
    const result = createTransactionSchema.safeParse({
      accountId: crypto.randomUUID(),
      description: "Spesa",
      categoryId: crypto.randomUUID(),
      amount: 0,
      date: "2026-02-10",
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data malformata", () => {
    const result = createTransactionSchema.safeParse({
      accountId: crypto.randomUUID(),
      description: "Spesa",
      categoryId: crypto.randomUUID(),
      amount: 10,
      date: "10-02-2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTransactionSchema", () => {
  it("accetta un aggiornamento parziale con un solo campo", () => {
    const result = updateTransactionSchema.safeParse({ categoryId: crypto.randomUUID() });
    expect(result.success).toBe(true);
  });

  it("rifiuta un oggetto vuoto", () => {
    const result = updateTransactionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accetta excludedAmount come numero non negativo", () => {
    const result = updateTransactionSchema.safeParse({ excludedAmount: 12.3 });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/validation/transactions.test.ts`
Expected: FAIL con "Cannot find module './transactions'"

- [ ] **Step 3: Implement `lib/validation/transactions.ts`**

```typescript
import { z } from "zod";

export { parseAmount } from "./accounts";

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().trim().min(1),
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .object({
    description: z.string().trim().min(1).optional(),
    categoryId: z.string().uuid().optional(),
    amount: z.number().positive().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida").optional(),
    excludedAmount: z.number().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/validation/transactions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validation/transactions.ts lib/validation/transactions.test.ts
git commit -m "feat: validazione Zod per creazione/aggiornamento transazioni"
```

---

### Task 4: Validazione — budget

**Files:**
- Create: `lib/validation/budgets.ts`
- Test: `lib/validation/budgets.test.ts`

**Interfaces:**
- Produce: `upsertBudgetSchema`, `UpsertBudgetInput`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/validation/budgets.test.ts
import { describe, expect, it } from "vitest";
import { upsertBudgetSchema } from "./budgets";

describe("upsertBudgetSchema", () => {
  it("accetta un importo mensile non negativo", () => {
    expect(upsertBudgetSchema.safeParse({ monthlyAmount: 300 }).success).toBe(true);
    expect(upsertBudgetSchema.safeParse({ monthlyAmount: 0 }).success).toBe(true);
  });

  it("rifiuta un importo negativo", () => {
    expect(upsertBudgetSchema.safeParse({ monthlyAmount: -10 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/validation/budgets.test.ts`
Expected: FAIL con "Cannot find module './budgets'"

- [ ] **Step 3: Implement `lib/validation/budgets.ts`**

```typescript
import { z } from "zod";

export const upsertBudgetSchema = z.object({
  monthlyAmount: z.number().min(0),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/validation/budgets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validation/budgets.ts lib/validation/budgets.test.ts
git commit -m "feat: validazione Zod per upsert budget mensile"
```

---

### Task 5: API — categorie (lettura)

**Files:**
- Create: `app/api/categories/route.ts`
- Test: `app/api/categories/route.test.ts`

**Interfaces:**
- Produce: `GET /api/categories` → `Category[]`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/categories/route.test.ts
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET /api/categories", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-categories-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-categories-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(new NextRequest("http://localhost/api/categories"));
    expect(response.status).toBe(401);
  });

  it("ritorna solo le categorie dell'utente autenticato", async () => {
    await db.insert(categories).values([
      { userId, name: "Affitto", type: "fissa" },
      { userId, name: "Svago", type: "variabile" },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/categories"));
    expect(response.status).toBe(200);
    const list = await response.json();
    expect(list).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test app/api/categories/route.test.ts`
Expected: FAIL con "Cannot find module './route'"

- [ ] **Step 3: Implement `app/api/categories/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, session.user.id))
    .orderBy(asc(categories.createdAt));

  return Response.json(userCategories);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test app/api/categories/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/categories/route.ts app/api/categories/route.test.ts
git commit -m "feat: aggiunge GET /api/categories"
```

---

### Task 6: API — transazioni (lista e creazione)

**Files:**
- Create: `app/api/transactions/route.ts`
- Test: `app/api/transactions/route.test.ts`

**Interfaces:**
- Consuma: `createTransactionSchema` (Task 3)
- Produce: `GET /api/transactions?from&to` → `Transaction[]` (solo `amount < 0`), `POST /api/transactions` → `Transaction` (201)

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/transactions/route.test.ts
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
import { GET, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET/POST /api/transactions", () => {
  let userId: string;
  let manualAccountId: string;
  let autoAccountId: string;
  let categoryId: string;

  beforeEach(async () => {
    const testId = `test-transactions-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-transactions-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [manualAccount] = await db
      .insert(accounts)
      .values({ userId, name: "Contanti", type: "Contanti", balance: "0.00" })
      .returning();
    manualAccountId = manualAccount.id;

    const [autoAccount] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0.00", source: "auto" })
      .returning();
    autoAccountId = autoAccount.id;

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();
    categoryId = category.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31"));
    expect(response.status).toBe(401);
  });

  it("risponde 400 senza from/to", async () => {
    const response = await GET(new NextRequest("http://localhost/api/transactions"));
    expect(response.status).toBe(400);
  });

  it("crea una spesa manuale con importo negato e la ritorna nella lista, escludendo le entrate", async () => {
    await db.insert(transactions).values({
      userId,
      accountId: manualAccountId,
      categoryId,
      description: "Stipendio",
      amount: "2000.00",
      date: "2026-02-01",
      source: "manuale",
    });

    const postResponse = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: manualAccountId,
          description: "Spesa al supermercato",
          categoryId,
          amount: 42.5,
          date: "2026-02-10",
        }),
      })
    );
    expect(postResponse.status).toBe(201);
    const created = await postResponse.json();
    expect(created.amount).toBe("-42.50");

    const getResponse = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31")
    );
    const list = await getResponse.json();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it("risponde 400 se il conto è auto", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: autoAccountId,
          description: "Spesa",
          categoryId,
          amount: 10,
          date: "2026-02-10",
        }),
      })
    );
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test app/api/transactions/route.test.ts`
Expected: FAIL con "Cannot find module './route'"

- [ ] **Step 3: Implement `app/api/transactions/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { and, desc, eq, gte, lt, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { createTransactionSchema } from "@/lib/validation/transactions";

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

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        lt(transactions.amount, "0"),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .orderBy(desc(transactions.date));

  return Response.json(rows);
}

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

  const [transaction] = await db
    .insert(transactions)
    .values({
      userId: session.user.id,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      amount: (-parsed.data.amount).toFixed(2),
      date: parsed.data.date,
      source: "manuale",
    })
    .returning();

  return Response.json(transaction, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test app/api/transactions/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/transactions/route.ts app/api/transactions/route.test.ts
git commit -m "feat: aggiunge GET/POST /api/transactions"
```

---

### Task 7: API — transazione singola (aggiornamento, dividi, eliminazione)

**Files:**
- Create: `app/api/transactions/[id]/route.ts`
- Test: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consuma: `updateTransactionSchema` (Task 3), `isValidExcludedAmount` (esistente in `lib/db/schema/transactions.ts`)
- Produce: `PATCH /api/transactions/[id]`, `DELETE /api/transactions/[id]`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/transactions/[id]/route.test.ts
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
import { PATCH, DELETE } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("PATCH/DELETE /api/transactions/[id]", () => {
  let userId: string;
  let otherUserId: string;
  let accountId: string;
  let categoryId: string;
  let otherCategoryId: string;

  beforeEach(async () => {
    const testId = `test-transaction-id-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-transaction-id-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const otherId = `test-transaction-id-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-transaction-id-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Contanti", type: "Contanti", balance: "0.00" })
      .returning();
    accountId = account.id;

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();
    categoryId = category.id;

    const [otherCategory] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
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

  it("aggiorna descrizione/importo/data di una transazione manuale", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: "Spesa corretta", amount: 60, categoryId: otherCategoryId }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.description).toBe("Spesa corretta");
    expect(updated.amount).toBe("-60.00");
    expect(updated.categoryId).toBe(otherCategoryId);
  });

  it("risponde 403 se si tenta di modificare descrizione/importo/data di una transazione auto", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-50.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-1",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: "Modifica non permessa" }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(403);
  });

  it("permette di cambiare categoria e 'dividi' su una transazione auto", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-100.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-2",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: otherCategoryId, excludedAmount: 30 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.categoryId).toBe(otherCategoryId);
    expect(updated.excludedAmount).toBe("-30.00");
  });

  it("risponde 400 se excludedAmount supera l'importo", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ excludedAmount: 60 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(400);
  });

  it("risponde 404 su una transazione di un altro utente", async () => {
    const [otherTransaction] = await db
      .insert(transactions)
      .values({
        userId: otherUserId,
        accountId,
        categoryId,
        description: "Altrui",
        amount: "-10.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${otherTransaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: "Tentativo" }),
      }),
      { params: Promise.resolve({ id: otherTransaction.id }) }
    );

    expect(response.status).toBe(404);
  });

  it("elimina una transazione manuale", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Da eliminare",
        amount: "-10.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(204);
  });

  it("risponde 400 se si tenta di eliminare una transazione auto", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-10.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-3",
      })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test app/api/transactions/[id]/route.test.ts`
Expected: FAIL con "Cannot find module './route'"

- [ ] **Step 3: Implement `app/api/transactions/[id]/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { isValidExcludedAmount, transactions } from "@/lib/db/schema/transactions";
import { updateTransactionSchema } from "@/lib/validation/transactions";

/** Recupera una transazione solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedTransaction(userId: string, transactionId: string) {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  return transaction ?? null;
}

const MANUAL_ONLY_FIELDS = ["description", "amount", "date"] as const;

/**
 * Aggiorna una transazione del proprio utente; 404 se non propria. Per una transazione "auto" sono
 * modificabili solo categoria ed excludedAmount ("Dividi"): un tentativo di cambiare descrizione,
 * importo o data risponde 403.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const transaction = await getOwnedTransaction(session.user.id, id);
  if (!transaction) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (transaction.source === "auto" && MANUAL_ONLY_FIELDS.some((field) => field in parsed.data)) {
    return Response.json(
      { error: 'Per una transazione automatica sono modificabili solo categoria e "Dividi"' },
      { status: 403 }
    );
  }

  const newAmount = parsed.data.amount !== undefined ? -parsed.data.amount : Number(transaction.amount);
  let newExcludedAmount: number | undefined;
  if (parsed.data.excludedAmount !== undefined) {
    newExcludedAmount = -Math.abs(parsed.data.excludedAmount);
    if (!isValidExcludedAmount(newAmount, newExcludedAmount)) {
      return Response.json({ error: "Quota esclusa non valida" }, { status: 400 });
    }
  }

  const { amount, excludedAmount, ...rest } = parsed.data;
  const [updated] = await db
    .update(transactions)
    .set({
      ...rest,
      ...(amount !== undefined ? { amount: newAmount.toFixed(2) } : {}),
      ...(newExcludedAmount !== undefined ? { excludedAmount: newExcludedAmount.toFixed(2) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, id))
    .returning();

  return Response.json(updated);
}

/** Elimina una transazione manuale del proprio utente; 404 se non propria, 400 se auto. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const transaction = await getOwnedTransaction(session.user.id, id);
  if (!transaction) {
    return new Response(null, { status: 404 });
  }

  if (transaction.source === "auto") {
    return Response.json({ error: "Una transazione automatica non può essere eliminata" }, { status: 400 });
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test app/api/transactions/[id]/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/transactions/[id]/route.ts" "app/api/transactions/[id]/route.test.ts"
git commit -m "feat: aggiunge PATCH/DELETE /api/transactions/[id]"
```

---

### Task 8: API — budget (lettura e upsert)

**Files:**
- Create: `app/api/budgets/route.ts`
- Create: `app/api/budgets/[categoryId]/route.ts`
- Test: `app/api/budgets/route.test.ts`
- Test: `app/api/budgets/[categoryId]/route.test.ts`

**Interfaces:**
- Consuma: `upsertBudgetSchema` (Task 4)
- Produce: `GET /api/budgets` → `Budget[]`, `PUT /api/budgets/[categoryId]` → `Budget`

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/budgets/route.test.ts
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { budgets } from "@/lib/db/schema/budgets";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET /api/budgets", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-budgets-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-budgets-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(new NextRequest("http://localhost/api/budgets"));
    expect(response.status).toBe(401);
  });

  it("ritorna i budget dell'utente", async () => {
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Affitto", type: "fissa" })
      .returning();
    await db.insert(budgets).values({ userId, categoryId: category.id, monthlyAmount: "700.00" });

    const response = await GET(new NextRequest("http://localhost/api/budgets"));
    expect(response.status).toBe(200);
    const list = await response.json();
    expect(list).toHaveLength(1);
    expect(list[0].monthlyAmount).toBe("700.00");
  });
});
```

```typescript
// app/api/budgets/[categoryId]/route.test.ts
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { PUT } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("PUT /api/budgets/[categoryId]", () => {
  let userId: string;
  let categoryId: string;

  beforeEach(async () => {
    const testId = `test-budget-id-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-budget-id-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Affitto", type: "fissa" })
      .returning();
    categoryId = category.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("crea il budget se non esiste", async () => {
    const response = await PUT(
      new NextRequest(`http://localhost/api/budgets/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 700 }),
      }),
      { params: Promise.resolve({ categoryId }) }
    );
    expect(response.status).toBe(200);
    const budget = await response.json();
    expect(budget.monthlyAmount).toBe("700.00");
  });

  it("aggiorna il budget se esiste già (upsert)", async () => {
    await PUT(
      new NextRequest(`http://localhost/api/budgets/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 700 }),
      }),
      { params: Promise.resolve({ categoryId }) }
    );

    const response = await PUT(
      new NextRequest(`http://localhost/api/budgets/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 900 }),
      }),
      { params: Promise.resolve({ categoryId }) }
    );
    expect(response.status).toBe(200);
    const budget = await response.json();
    expect(budget.monthlyAmount).toBe("900.00");
  });

  it("risponde 404 su una categoria inesistente/altrui", async () => {
    const response = await PUT(
      new NextRequest(`http://localhost/api/budgets/${crypto.randomUUID()}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 100 }),
      }),
      { params: Promise.resolve({ categoryId: crypto.randomUUID() }) }
    );
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test app/api/budgets`
Expected: FAIL con "Cannot find module './route'"

- [ ] **Step 3: Implement**

```typescript
// app/api/budgets/route.ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets } from "@/lib/db/schema/budgets";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userBudgets = await db.select().from(budgets).where(eq(budgets.userId, session.user.id));
  return Response.json(userBudgets);
}
```

```typescript
// app/api/budgets/[categoryId]/route.ts
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { upsertBudgetSchema } from "@/lib/validation/budgets";

/** Crea o aggiorna (upsert) il budget mensile di una categoria del proprio utente; 404 se non propria. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { categoryId } = await params;
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, session.user.id)));
  if (!category) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = upsertBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [budget] = await db
    .insert(budgets)
    .values({ userId: session.user.id, categoryId, monthlyAmount: parsed.data.monthlyAmount.toFixed(2) })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId],
      set: { monthlyAmount: parsed.data.monthlyAmount.toFixed(2), updatedAt: new Date() },
    })
    .returning();

  return Response.json(budget);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test app/api/budgets`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/budgets
git commit -m "feat: aggiunge GET /api/budgets e PUT /api/budgets/[categoryId]"
```

---

### Task 9: Query hook — categorie

**Files:**
- Create: `lib/queries/categories.ts`

**Interfaces:**
- Consuma: `GET /api/categories` (Task 5)
- Produce: `useCategoriesQuery()`

- [ ] **Step 1: Implement `lib/queries/categories.ts`**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import type { Category } from "@/lib/db/schema/categories";

const CATEGORIES_QUERY_KEY = ["categories"] as const;

async function fetchCategories(): Promise<Category[]> {
  const response = await fetch("/api/categories");
  if (!response.ok) {
    throw new Error("Impossibile caricare le categorie");
  }
  return response.json();
}

/** Recupera la lista delle categorie dell'utente autenticato. */
export function useCategoriesQuery() {
  return useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: fetchCategories });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore relativo a `lib/queries/categories.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/queries/categories.ts
git commit -m "feat: aggiunge useCategoriesQuery"
```

---

### Task 10: Query hook — transazioni

**Files:**
- Create: `lib/queries/transactions.ts`

**Interfaces:**
- Consuma: `GET/POST /api/transactions` (Task 6), `PATCH/DELETE /api/transactions/[id]` (Task 7), `CreateTransactionInput`/`UpdateTransactionInput` (Task 3)
- Produce: `useTransactionsQuery(from, to)`, `useCreateTransactionMutation()`, `useUpdateTransactionMutation()`, `useDeleteTransactionMutation()`

- [ ] **Step 1: Implement `lib/queries/transactions.ts`**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/lib/validation/transactions";

function transactionsQueryKey(from: string, to: string) {
  return ["transactions", from, to] as const;
}

async function fetchTransactions(from: string, to: string): Promise<Transaction[]> {
  const response = await fetch(`/api/transactions?from=${from}&to=${to}`);
  if (!response.ok) {
    throw new Error("Impossibile caricare le transazioni");
  }
  return response.json();
}

/** Recupera le transazioni di spesa dell'utente nell'intervallo [from, to] (YYYY-MM-DD). */
export function useTransactionsQuery(from: string, to: string) {
  return useQuery({ queryKey: transactionsQueryKey(from, to), queryFn: () => fetchTransactions(from, to) });
}

/** Crea una spesa manuale e invalida tutte le liste di transazioni in cache. */
export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile creare la transazione");
      }
      return response.json() as Promise<Transaction>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

/** Aggiorna una transazione (categoria/dividi sempre; descrizione/importo/data solo se manuale) e invalida la cache. */
export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTransactionInput }) => {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile aggiornare la transazione");
      }
      return response.json() as Promise<Transaction>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

/** Elimina una spesa manuale e invalida la cache. */
export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile eliminare la transazione");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore relativo a `lib/queries/transactions.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/queries/transactions.ts
git commit -m "feat: aggiunge hook TanStack Query per le transazioni"
```

---

### Task 11: Query hook — budget

**Files:**
- Create: `lib/queries/budgets.ts`

**Interfaces:**
- Consuma: `GET /api/budgets` (Task 8), `PUT /api/budgets/[categoryId]` (Task 8), `UpsertBudgetInput` (Task 4)
- Produce: `useBudgetsQuery()`, `useUpsertBudgetMutation()`

- [ ] **Step 1: Implement `lib/queries/budgets.ts`**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Budget } from "@/lib/db/schema/budgets";
import type { UpsertBudgetInput } from "@/lib/validation/budgets";

const BUDGETS_QUERY_KEY = ["budgets"] as const;

async function fetchBudgets(): Promise<Budget[]> {
  const response = await fetch("/api/budgets");
  if (!response.ok) {
    throw new Error("Impossibile caricare i budget");
  }
  return response.json();
}

/** Recupera i budget mensili per categoria dell'utente autenticato. */
export function useBudgetsQuery() {
  return useQuery({ queryKey: BUDGETS_QUERY_KEY, queryFn: fetchBudgets });
}

/** Crea o aggiorna il budget mensile di una categoria e invalida la cache. */
export function useUpsertBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, input }: { categoryId: string; input: UpsertBudgetInput }) => {
      const response = await fetch(`/api/budgets/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile aggiornare il budget");
      }
      return response.json() as Promise<Budget>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
    },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore relativo a `lib/queries/budgets.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/queries/budgets.ts
git commit -m "feat: aggiunge hook TanStack Query per i budget"
```

---

### Task 12: Installazione componenti shadcn mancanti (slider, chart)

**Files:**
- Create: `components/ui/slider.tsx` (generato da shadcn)
- Create: `components/ui/chart.tsx` (generato da shadcn)
- Modify: `package.json` (aggiunge `recharts` e dipendenze slider)

Nessun componente `slider`/`chart` esiste ancora nel repo (verificato: nessun file, nessuna dipendenza `recharts` in `package.json`). Servono per "Dividi" (Task 17) e i grafici (Task 16).

- [ ] **Step 1: Installare i componenti**

Run: `pnpm dlx shadcn@latest add slider chart`
Expected: crea `components/ui/slider.tsx` e `components/ui/chart.tsx`, aggiunge `recharts` (e eventuali dipendenze del primitivo slider) a `package.json`

- [ ] **Step 2: Verificare che il progetto compili ancora**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add components/ui/slider.tsx components/ui/chart.tsx package.json pnpm-lock.yaml
git commit -m "chore: installa componenti shadcn slider e chart"
```

---

### Task 13: Componente — selettore periodo

**Files:**
- Create: `components/domain/expenses/expenses-period-selector.tsx`

**Interfaces:**
- Consuma: `ExpensePeriod` (Task 1)
- Produce: `ExpensesPeriodSelector`, `ExpensesPeriodSelectorProps`

- [ ] **Step 1: Implement**

```tsx
"use client";

/** Selettore periodo Settimana/Mese/3 mesi/Anno per la schermata Spese (stesso pattern a pillole di AddAccountForm). */

import { cn } from "@/lib/utils";
import type { ExpensePeriod } from "@/lib/calc/expenses";

const PERIOD_OPTIONS: { value: ExpensePeriod; label: string }[] = [
  { value: "settimana", label: "Settimana" },
  { value: "mese", label: "Mese" },
  { value: "3mesi", label: "3 mesi" },
  { value: "anno", label: "Anno" },
];

export interface ExpensesPeriodSelectorProps {
  value: ExpensePeriod;
  onChange: (period: ExpensePeriod) => void;
}

export function ExpensesPeriodSelector({ value, onChange }: ExpensesPeriodSelectorProps) {
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

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/expenses-period-selector.tsx
git commit -m "feat: aggiunge ExpensesPeriodSelector"
```

---

### Task 14: Componente — KPI cards

**Files:**
- Create: `components/domain/expenses/expenses-kpi-cards.tsx`

**Interfaces:**
- Consuma: `computeKpis`, `ExpensePeriod` (Task 1), `StatCard` (esistente), `formatCurrency` (esistente)
- Produce: `ExpensesKpiCards`, `ExpensesKpiCardsProps`

- [ ] **Step 1: Implement**

```tsx
/** Riga di KPI per la schermata Spese: Speso nel periodo, Budget rimanente, Media giornaliera. */

import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { computeKpis, type ExpensePeriod } from "@/lib/calc/expenses";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";

export interface ExpensesKpiCardsProps {
  transactions: Transaction[];
  budgets: Budget[];
  period: ExpensePeriod;
  currency: string;
  /** Data di riferimento per il calcolo (default: adesso). */
  referenceDate?: Date;
}

export function ExpensesKpiCards({
  transactions,
  budgets,
  period,
  currency,
  referenceDate = new Date(),
}: ExpensesKpiCardsProps) {
  const kpis = computeKpis(transactions, budgets, period, referenceDate);
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
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Media giornaliera
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-3xl font-medium tabular-nums">
            {formatCurrency(kpis.mediaGiornaliera, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{trendLabel}</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/expenses-kpi-cards.tsx
git commit -m "feat: aggiunge ExpensesKpiCards"
```

---

### Task 15: Componente — categorie con budget editabile

**Files:**
- Create: `components/domain/expenses/category-breakdown.tsx`

**Interfaces:**
- Consuma: `CategoryAmount` (Task 2), `useUpsertBudgetMutation` (Task 11)
- Produce: `CategoryBreakdown`, `CategoryBreakdownProps`

- [ ] **Step 1: Implement**

```tsx
"use client";

/** Blocco "Per categoria": importo speso e budget mensile editabile inline, per ciascuna categoria dell'utente. */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { useUpsertBudgetMutation } from "@/lib/queries/budgets";
import type { CategoryAmount } from "@/lib/calc/expenses";
import type { Budget } from "@/lib/db/schema/budgets";

export interface CategoryBreakdownProps {
  categoryAmounts: CategoryAmount[];
  budgets: Budget[];
  currency: string;
}

export function CategoryBreakdown({ categoryAmounts, budgets, currency }: CategoryBreakdownProps) {
  const upsertMutation = useUpsertBudgetMutation();

  function budgetFor(categoryId: string): number {
    const budget = budgets.find((b) => b.categoryId === categoryId);
    return budget ? Number(budget.monthlyAmount) : 0;
  }

  function commitBudget(categoryId: string, raw: string) {
    const normalized = raw.trim().replace(",", ".");
    const value = Number(normalized);
    if (normalized === "" || !Number.isFinite(value) || value < 0) return;
    if (value === budgetFor(categoryId)) return;
    upsertMutation.mutate({ categoryId, input: { monthlyAmount: value } });
  }

  return (
    <Card className="divide-y divide-border p-0">
      {categoryAmounts.map((entry) => (
        <CategoryBreakdownRow
          key={entry.categoryId}
          entry={entry}
          budgetAmount={budgetFor(entry.categoryId)}
          currency={currency}
          onCommitBudget={(raw) => commitBudget(entry.categoryId, raw)}
        />
      ))}
    </Card>
  );
}

interface CategoryBreakdownRowProps {
  entry: CategoryAmount;
  budgetAmount: number;
  currency: string;
  onCommitBudget: (raw: string) => void;
}

function CategoryBreakdownRow({ entry, budgetAmount, currency, onCommitBudget }: CategoryBreakdownRowProps) {
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));

  React.useEffect(() => {
    setBudgetInput(String(budgetAmount));
  }, [budgetAmount]);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{entry.name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(entry.amount, currency)} speso</p>
      </div>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>Budget</span>
        <Input
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          onBlur={() => onCommitBudget(budgetInput)}
          className="h-7 w-20 text-right text-sm"
          aria-label={`Budget mensile per ${entry.name}`}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/category-breakdown.tsx
git commit -m "feat: aggiunge CategoryBreakdown con budget editabile inline"
```

---

### Task 16: Componente — grafici (donut + andamento 6 mesi)

**Files:**
- Create: `components/domain/expenses/expense-charts.tsx`

**Interfaces:**
- Consuma: `FixedVsVariable`, `MonthlyTotal` (Task 2), `components/ui/chart.tsx` (Task 12)
- Produce: `ExpenseCharts`, `ExpenseChartsProps`

- [ ] **Step 1: Implement**

```tsx
"use client";

/** Grafici Spese: donut "Fisse vs variabili" e barre "Andamento ultimi 6 mesi". */

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { FixedVsVariable, MonthlyTotal } from "@/lib/calc/expenses";

const FIXED_VS_VARIABLE_CONFIG = {
  fissa: { label: "Fisse", color: "var(--chart-1)" },
  variabile: { label: "Variabili", color: "var(--chart-2)" },
} satisfies ChartConfig;

const TREND_CONFIG = {
  total: { label: "Speso", color: "var(--chart-1)" },
} satisfies ChartConfig;

export interface ExpenseChartsProps {
  fixedVsVariable: FixedVsVariable;
  monthlyTrend: MonthlyTotal[];
}

export function ExpenseCharts({ fixedVsVariable, monthlyTrend }: ExpenseChartsProps) {
  const donutData = [
    { key: "fissa", label: "Fisse", value: fixedVsVariable.fissa, fill: "var(--color-fissa)" },
    { key: "variabile", label: "Variabili", value: fixedVsVariable.variabile, fill: "var(--color-variabile)" },
  ];
  const trendData = monthlyTrend.map((month) => ({ label: month.label, total: month.total }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fisse vs variabili
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={FIXED_VS_VARIABLE_CONFIG} className="mx-auto aspect-square max-h-56">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie data={donutData} dataKey="value" nameKey="label" innerRadius={50}>
                {donutData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

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
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore. Se l'API esatta di `ChartContainer`/`ChartConfig` generata da shadcn differisse leggermente da quella usata qui, adattare gli import/props a quanto effettivamente generato nel Task 12 (il componente `chart.tsx` di shadcn segue questo pattern in modo standard, ma verificarlo).

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/expense-charts.tsx
git commit -m "feat: aggiunge ExpenseCharts (donut fisse/variabili + andamento 6 mesi)"
```

---

### Task 17: Componente — slider "Dividi"

**Files:**
- Create: `components/domain/expenses/split-slider.tsx`

**Interfaces:**
- Consuma: `useUpdateTransactionMutation` (Task 10), `components/ui/slider.tsx` (Task 12)
- Produce: `SplitSlider`, `SplitSliderProps`

- [ ] **Step 1: Implement**

```tsx
"use client";

/** UI "Dividi": ripartisce l'importo di una transazione tra spesa effettiva e quota esclusa dal conteggio. */

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface SplitSliderProps {
  transaction: Transaction;
  currency: string;
  onClose: () => void;
}

export function SplitSlider({ transaction, currency, onClose }: SplitSliderProps) {
  const updateMutation = useUpdateTransactionMutation();
  const totalAmount = Math.abs(Number(transaction.amount));
  const [excluded, setExcluded] = React.useState(Math.abs(Number(transaction.excludedAmount)));

  function commit() {
    updateMutation.mutate({ id: transaction.id, input: { excludedAmount: excluded } }, { onSuccess: onClose });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa
        (rimborsi, quote di altri, giroconto).
      </p>
      <Slider
        value={[excluded]}
        min={0}
        max={totalAmount}
        step={0.01}
        onValueChange={([value]) => setExcluded(value)}
        onValueCommit={commit}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
        <span>Esclusa dal conteggio: {formatCurrency(excluded, currency)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/split-slider.tsx
git commit -m "feat: aggiunge SplitSlider (Dividi)"
```

---

### Task 18: Componente — riga transazione

**Files:**
- Create: `components/domain/expenses/transaction-row.tsx`

**Interfaces:**
- Consuma: `useUpdateTransactionMutation`, `useDeleteTransactionMutation` (Task 10), `CurrencyInput` (esistente, riesportato da `components/domain/accounts`), `SplitSlider` (Task 17)
- Produce: `TransactionRow`, `TransactionRowProps`

- [ ] **Step 1: Implement**

```tsx
"use client";

/** Riga singola della lista Transazioni in Spese: rendering diverso per source manuale/auto. */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CurrencyInput } from "@/components/domain/accounts";
import { formatCurrency } from "@/lib/format";
import { useDeleteTransactionMutation, useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";
import { SplitSlider } from "./split-slider";

export interface TransactionRowProps {
  transaction: Transaction;
  categories: Category[];
  currency: string;
}

export function TransactionRow({ transaction, categories, currency }: TransactionRowProps) {
  const isAuto = transaction.source === "auto";
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();

  const [description, setDescription] = React.useState(transaction.description);
  const [amountValue, setAmountValue] = React.useState<number | null>(Math.abs(Number(transaction.amount)));
  const [date, setDate] = React.useState(transaction.date);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);

  function commitCategory(categoryId: string) {
    if (categoryId === transaction.categoryId) return;
    updateMutation.mutate({ id: transaction.id, input: { categoryId } });
  }

  function commitDescription() {
    if (description.trim() === "" || description === transaction.description) return;
    updateMutation.mutate({ id: transaction.id, input: { description } });
  }

  function commitAmount() {
    if (amountValue === null || amountValue === Math.abs(Number(transaction.amount))) return;
    updateMutation.mutate({ id: transaction.id, input: { amount: amountValue } });
  }

  function commitDate() {
    if (date === transaction.date) return;
    updateMutation.mutate({ id: transaction.id, input: { date } });
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(transaction.id);
    setDialogOpen(false);
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          {isAuto ? (
            <p className="truncate text-sm font-medium text-foreground">{transaction.description}</p>
          ) : (
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              className="h-7 text-sm font-medium"
              aria-label="Descrizione transazione"
            />
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isAuto ? (
              <span>{transaction.date}</span>
            ) : (
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={commitDate}
                className="h-6 w-32 text-xs"
                aria-label="Data transazione"
              />
            )}
            <span>·</span>
            <Select value={transaction.categoryId} onValueChange={commitCategory}>
              <SelectTrigger size="sm" className="h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <Badge variant={isAuto ? "secondary" : "outline"} className="shrink-0">
            {isAuto ? "Auto" : "Manuale"}
          </Badge>

          {isAuto ? (
            <p className="w-24 shrink-0 text-right text-sm font-medium tabular-nums sm:w-28">
              {formatCurrency(Math.abs(Number(transaction.amount)), currency)}
            </p>
          ) : (
            <CurrencyInput
              value={amountValue}
              onChange={setAmountValue}
              onBlur={commitAmount}
              currency={currency}
              className="w-24 text-right sm:w-28"
              aria-label="Importo"
            />
          )}

          <button
            type="button"
            onClick={() => setSplitOpen((open) => !open)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            aria-pressed={splitOpen}
          >
            Dividi
          </button>

          {!isAuto && (
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Elimina transazione"
              >
                ✕
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare questa transazione?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{transaction.description}&quot; verrà eliminata definitivamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteConfirm}>Elimina</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {splitOpen && (
        <SplitSlider transaction={transaction} currency={currency} onClose={() => setSplitOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/transaction-row.tsx
git commit -m "feat: aggiunge TransactionRow"
```

---

### Task 19: Componente — form "+ Aggiungi"

**Files:**
- Create: `components/domain/expenses/add-transaction-form.tsx`

**Interfaces:**
- Consuma: `useAccountsQuery` (esistente, da `lib/queries/accounts.ts`), `useCreateTransactionMutation` (Task 10), `CurrencyInput` (esistente)
- Produce: `AddTransactionForm`, `AddTransactionFormProps`

- [ ] **Step 1: Implement**

```tsx
"use client";

/** Form "+ Aggiungi" spesa: crea una transazione manuale su uno dei conti manuali dell'utente. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/domain/accounts";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useCreateTransactionMutation } from "@/lib/queries/transactions";
import type { Category } from "@/lib/db/schema/categories";

export interface AddTransactionFormProps {
  categories: Category[];
  currency: string;
}

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function AddTransactionForm({ categories, currency }: AddTransactionFormProps) {
  const { data: accounts } = useAccountsQuery();
  const manualAccounts = (accounts ?? []).filter((account) => account.source === "manuale");
  const createMutation = useCreateTransactionMutation();

  const [accountId, setAccountId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [amountValue, setAmountValue] = React.useState<number | null>(null);
  const [date, setDate] = React.useState(todayDateString());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accountId && manualAccounts.length > 0) setAccountId(manualAccounts[0].id);
  }, [manualAccounts, accountId]);

  React.useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!accountId) {
      setError("Serve almeno un conto manuale per registrare una spesa");
      return;
    }
    if (description.trim() === "" || !categoryId) {
      setError("Descrizione e categoria sono obbligatorie");
      return;
    }
    if (amountValue === null || amountValue <= 0) {
      setError("L'importo non è valido");
      return;
    }

    createMutation.mutate(
      { accountId, description: description.trim(), categoryId, amount: amountValue, date },
      {
        onSuccess: () => {
          setDescription("");
          setAmountValue(null);
          setDate(todayDateString());
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Conto</label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Conto" />
          </SelectTrigger>
          <SelectContent>
            {manualAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground" htmlFor="new-transaction-description">
          Descrizione
        </label>
        <Input
          id="new-transaction-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full sm:w-40"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Categoria</label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground" htmlFor="new-transaction-amount">
          Importo
        </label>
        <CurrencyInput
          value={amountValue}
          onChange={setAmountValue}
          currency={currency}
          className="w-full sm:w-28"
          aria-label="Importo"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground" htmlFor="new-transaction-date">
          Data
        </label>
        <Input
          id="new-transaction-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full sm:w-36"
        />
      </div>

      <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
        + Aggiungi
      </Button>

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/add-transaction-form.tsx
git commit -m "feat: aggiunge AddTransactionForm"
```

---

### Task 20: Barrel file

**Files:**
- Create: `components/domain/expenses/index.ts`

**Interfaces:**
- Consuma: tutti i componenti dei Task 13-19
- Produce: punto di ingresso unico `@/components/domain/expenses`

- [ ] **Step 1: Implement**

```typescript
/**
 * components/domain/expenses — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Spese.
 */

export { ExpensesPeriodSelector } from "./expenses-period-selector";
export type { ExpensesPeriodSelectorProps } from "./expenses-period-selector";
export { ExpensesKpiCards } from "./expenses-kpi-cards";
export type { ExpensesKpiCardsProps } from "./expenses-kpi-cards";
export { CategoryBreakdown } from "./category-breakdown";
export type { CategoryBreakdownProps } from "./category-breakdown";
export { ExpenseCharts } from "./expense-charts";
export type { ExpenseChartsProps } from "./expense-charts";
export { TransactionRow } from "./transaction-row";
export type { TransactionRowProps } from "./transaction-row";
export { SplitSlider } from "./split-slider";
export type { SplitSliderProps } from "./split-slider";
export { AddTransactionForm } from "./add-transaction-form";
export type { AddTransactionFormProps } from "./add-transaction-form";
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/index.ts
git commit -m "feat: aggiunge barrel file per components/domain/expenses"
```

---

### Task 21: Pagina Spese

**Files:**
- Create: `app/(app)/spese/page.tsx`

**Interfaces:**
- Consuma: barrel `components/domain/expenses` (Task 20), `lib/calc/expenses` (Task 1-2, incluso `computeSummary`), `useTransactionsQuery` (Task 10), `useCategoriesQuery` (Task 9), `useBudgetsQuery` (Task 11), `authClient` (esistente)

- [ ] **Step 1: Implement**

```tsx
"use client";

/** Pagina Spese: orchestra periodo selezionato, KPI, grafici, categorie/budget, lista transazioni e form di aggiunta. */

import * as React from "react";
import {
  AddTransactionForm,
  CategoryBreakdown,
  ExpenseCharts,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  TransactionRow,
} from "@/components/domain/expenses";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import {
  compute6MonthTrend,
  computeCategoryBreakdown,
  computeFixedVsVariable,
  computeSummary,
  getPeriodRange,
  type ExpensePeriod,
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
  const referenceDate = React.useMemo(() => new Date(), []);
  const [period, setPeriod] = React.useState<ExpensePeriod>("mese");

  const { from, to } = fetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to);
  const { data: categories } = useCategoriesQuery();
  const { data: budgets } = useBudgetsQuery();

  const safeTransactions = transactions ?? [];
  const safeCategories = categories ?? [];
  const safeBudgets = budgets ?? [];

  const range = getPeriodRange(period, referenceDate);
  const transactionsInPeriod = safeTransactions.filter(
    (t) => t.date >= toDateString(range.from) && t.date <= toDateString(range.to)
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Spese</h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(range.from)} –{" "}
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(range.to)}
          </p>
        </div>
        <ExpensesPeriodSelector value={period} onChange={setPeriod} />
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
            transactions={safeTransactions}
            budgets={safeBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
          />

          <CategoryBreakdown
            categoryAmounts={computeCategoryBreakdown(safeTransactions, safeCategories, period, referenceDate)}
            budgets={safeBudgets}
            currency={currency}
          />

          <ExpenseCharts
            fixedVsVariable={computeFixedVsVariable(safeTransactions, safeCategories, period, referenceDate)}
            monthlyTrend={compute6MonthTrend(safeTransactions, referenceDate)}
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
                Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto.
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
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: build completata senza errori

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/spese/page.tsx"
git commit -m "feat: aggiunge pagina Spese"
```

- [ ] **Step 4: Verifica manuale in browser**

Run: `pnpm dev`, navigare su `/spese` da un utente autenticato con almeno un conto manuale.
Verificare: selettore periodo cambia KPI/categorie/grafici/lista in modo coerente; "+ Aggiungi" crea una spesa; modifica inline descrizione/importo/data/categoria su una transazione manuale; "Dividi" aggiorna in tempo reale i totali; "✕" elimina una transazione manuale; su una transazione "auto" (se presente da un conto GoCardless) solo categoria e "Dividi" sono modificabili; budget mensile per categoria si salva e "Budget rimanente" lo riflette.

---

## Note per l'esecutore

- Ogni task da 1 a 8 segue rigorosamente TDD (test prima, verifica fallimento, implementazione, verifica successo). I task 9-20 non hanno test dedicati perché il progetto non testa componenti/hook TanStack Query — solo funzioni pure e route API (vedi convenzione esistente in `lib/queries/accounts.ts` e `components/domain/accounts/*.tsx`, nessuno dei quali ha test associati salvo `accounts-kpi.utils.test.ts`).
- Il Task 12 (installazione `slider`/`chart`) è un prerequisito bloccante per i Task 16 e 17: se fallisce o genera un'API diversa da quella assunta qui, va risolto prima di proseguire.
- Non eseguire mai `git push`: fermarsi al commit locale di ogni task, come da regola di progetto in `CLAUDE.md`.
