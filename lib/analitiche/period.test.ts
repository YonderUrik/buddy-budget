import { describe, expect, it } from "vitest";
import { toDateKey } from "@/lib/calc/net-worth";
import type { Transaction } from "@/lib/db/schema/transactions";
import { DEFAULT_ASSUMPTIONS, resolveAssumptions } from "./assumptions";
import { analyticsTransactionsRange, buildAnalyticsBase } from "./base";
import { dataPeriodSchema, resolvePeriodRange, type DataPeriod } from "./period";

const TODAY = new Date(2026, 9, 12);
const keys = (p: DataPeriod) => {
  const r = resolvePeriodRange(p, TODAY);
  return { from: toDateKey(r.from), to: toDateKey(r.to), months: r.months };
};

function tx(date: string, amount: number, excluded = 0): Transaction {
  return { id: `${date}-${amount}`, date, amount: String(amount), excludedAmount: String(excluded), categoryId: null } as unknown as Transaction;
}

function base(period: DataPeriod, transactions: Transaction[]) {
  return buildAnalyticsBase({ today: TODAY, currency: "EUR", period, liquidity: 0, transactions, categories: [], investments: null, pensionFunds: [], debtsTotal: 0, snapshots: [] });
}

describe("periodo dei dati", () => {
  it("gli ultimi N mesi sono mesi interi, senza il mese in corso", () => {
    expect(keys({ kind: "ultimi", months: 12 })).toEqual({ from: "2025-10-01", to: "2026-09-30", months: 12 });
    expect(keys({ kind: "ultimi", months: 24 })).toEqual({ from: "2024-10-01", to: "2026-09-30", months: 24 });
  });

  it("un periodo scelto che arriva al mese in corso si ferma al mese prima", () => {
    expect(keys({ kind: "personalizzato", from: "2026-01", to: "2026-10" })).toEqual({ from: "2026-01-01", to: "2026-09-30", months: 9 });
    expect(keys({ kind: "personalizzato", from: "2023-02", to: "2023-07" })).toEqual({ from: "2023-02-01", to: "2023-07-31", months: 6 });
  });

  it("rifiuta periodi troppo corti, rovesciati o lunghi; quelli salvati non validi tornano al default", () => {
    expect(dataPeriodSchema.safeParse({ kind: "personalizzato", from: "2026-01", to: "2026-02" }).success).toBe(false);
    expect(dataPeriodSchema.safeParse({ kind: "personalizzato", from: "2026-05", to: "2026-01" }).success).toBe(false);
    expect(dataPeriodSchema.safeParse({ kind: "personalizzato", from: "2010-01", to: "2026-01" }).success).toBe(false);
    expect(dataPeriodSchema.safeParse({ kind: "ultimi", months: 36 }).success).toBe(false);
    expect(resolveAssumptions({ dataPeriod: { kind: "ultimi", months: 7 } }).dataPeriod).toEqual(DEFAULT_ASSUMPTIONS.dataPeriod);
    expect(resolveAssumptions({ dataPeriod: { kind: "ultimi", months: 24 } }).dataPeriod).toEqual({ kind: "ultimi", months: 24 });
  });

  it("legge i movimenti del periodo e sempre gli ultimi 13 mesi per la crescita", () => {
    expect(analyticsTransactionsRange({ kind: "ultimi", months: 12 }, TODAY)).toEqual({ from: "2025-10-01", to: "2026-10-31" });
    expect(analyticsTransactionsRange({ kind: "ultimi", months: 24 }, TODAY)).toEqual({ from: "2024-10-01", to: "2026-10-31" });
    expect(analyticsTransactionsRange({ kind: "personalizzato", from: "2026-03", to: "2026-08" }, TODAY)).toEqual({ from: "2025-10-01", to: "2026-10-31" });
  });
});

describe("spesa e risparmio dal periodo", () => {
  it("riporta a un anno la media del periodo e ignora il mese in corso e i giroconti", () => {
    const txs = [];
    for (let m = 1; m <= 24; m++) {
      const d = new Date(2024, 9 + m - 1, 5);
      const key = toDateKey(d);
      txs.push(tx(key, 2000), tx(key, m > 12 ? -1500 : -1000));
    }
    txs.push(tx("2026-10-05", -9999), tx("2026-09-10", -500, -500));
    const twelve = base({ kind: "ultimi", months: 12 }, txs).cashflow;
    expect(twelve.annualSpending).toBeCloseTo(18_000);
    expect(twelve.annualSavings).toBeCloseTo(6_000);
    const twentyFour = base({ kind: "ultimi", months: 24 }, txs).cashflow;
    expect(twentyFour.annualSpending).toBeCloseTo(15_000);
    expect(twentyFour.coveredMonths).toBe(24);
  });

  it("chi registra da pochi mesi ha la media su quei mesi, non sui mesi vuoti di prima", () => {
    const txs = ["2026-05-10", "2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10"].flatMap((d) => [tx(d, 2000), tx(d, -1200)]);
    const c = base({ kind: "ultimi", months: 24 }, txs).cashflow;
    expect(c.coveredMonths).toBe(5);
    expect(c.annualSpending).toBeCloseTo(14_400);
    expect(c.annualSavings).toBeCloseTo(9_600);
  });
});
