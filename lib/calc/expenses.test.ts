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
  computeCategoryBreakdown,
  computeFixedVsVariable,
  compute6MonthTrend,
} from "./expenses";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";
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
