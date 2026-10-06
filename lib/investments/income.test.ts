import { describe, expect, it } from "vitest";
import type { InvestmentTransactionInput } from "@/lib/calc/investments";
import { computeIncomeHistory } from "./income";
import type { OperationInsight } from "./operations-history";

function insight(id: string, instrumentId: string, type: InvestmentTransactionInput["type"], date: string, received: number): OperationInsight {
  return {
    transaction: { id, instrumentId, type, date, quantity: "0", price: "0", fxRate: "1", fees: "0", taxes: "0", grossAmount: String(received) },
    paid: 0,
    received,
    remainingQuantity: 0,
    currentValue: null,
    gain: received,
    gainPct: null,
    gainBase: 0,
  };
}

describe("computeIncomeHistory", () => {
  const insights = [
    insight("1", "etf", "dividendo", "2023-06-10", 10),
    insight("2", "btp", "cedola", "2025-10-01", 30),
    insight("3", "etf", "dividendo", "2026-03-10", 12),
    insight("4", "btp", "cedola", "2026-04-01", 30),
    { ...insight("5", "etf", "acquisto", "2026-05-01", 0), paid: 1000 },
  ];

  it("somma i proventi per anno, negli ultimi 12 mesi e sul costo attuale", () => {
    const history = computeIncomeHistory(insights, 2000, "2026-09-29");
    expect(history.total).toBe(82);
    expect(history.trailing).toBe(72);
    expect(history.yieldOnCost).toBeCloseTo(0.036);
    expect(history.count).toBe(4);
    expect(history.years).toEqual([
      { year: 2023, amount: 10 },
      { year: 2024, amount: 0 },
      { year: 2025, amount: 30 },
      { year: 2026, amount: 42 },
    ]);
    expect(history.topInstruments.map((i) => [i.instrumentId, i.trailing, i.total])).toEqual([
      ["btp", 60, 60],
      ["etf", 12, 22],
    ]);
  });

  it("senza proventi non inventa anni e senza costo non calcola il rendimento", () => {
    const history = computeIncomeHistory([], 0, "2026-09-29");
    expect(history.years).toEqual([]);
    expect(history.yieldOnCost).toBeNull();
    expect(history.count).toBe(0);
  });
});

it("preserves dated payments, FX, charges and signed corrections, excluding future payments", () => {
  const paid = insight("paid", "usd", "dividendo", "2024-02-01", 68);
  paid.transaction = { ...paid.transaction, grossAmount: "100", fxRate: "0.8", taxes: "10", fees: "2" };
  const correction = insight("correction", "usd", "dividendo", "2024-02-02", -5);
  const history = computeIncomeHistory([paid, correction, insight("future", "usd", "dividendo", "2027-01-01", 100)], 0, "2026-10-06");
  expect(history.payments.map((p) => p.id)).toEqual(["correction", "paid"]);
  expect(history.payments[1]).toMatchObject({ date: "2024-02-01", gross: 80, taxes: 10, fees: 2, net: 68 });
  expect(history.payments.reduce((sum, p) => sum + p.net, 0)).toBe(history.total);
});
