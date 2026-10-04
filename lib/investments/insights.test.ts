import { describe, expect, it } from "vitest";
import type { PortfolioSummary, PositionRow } from "@/lib/calc/investments";
import { computeConcentration, computeCurrencyExposure, computeValueBreakdown, daysUntil } from "./insights";

function row(name: string, value: number | null, costBasis: number, weight: number | null): PositionRow {
  return {
    instrument: { id: name, name, type: "etf", currency: "EUR", priceUnit: "unita" },
    quantity: 1,
    averagePrice: costBasis,
    costBasis,
    lastPrice: null,
    value,
    unrealizedGain: value === null ? null : value - costBasis,
    unrealizedGainPct: null,
    weight,
  };
}

function summary(rows: PositionRow[], realizedGain = 0, income = 0): PortfolioSummary {
  return {
    totalValue: 0,
    dayChange: null,
    dayChangePct: null,
    unrealizedGain: 0,
    realizedGain,
    income,
    totalGain: 0,
    totalGainPct: null,
    investedNet: 0,
    costBasis: 0,
    unpricedCount: 0,
    rows,
  };
}

describe("insights", () => {
  it("scompone il valore in pagato + mercato, ignorando le posizioni senza prezzo", () => {
    const b = computeValueBreakdown(summary([row("a", 1500, 1000, 0.75), row("b", 500, 600, 0.25), row("c", null, 300, null)], 20, 5));
    expect(b).toEqual({ paid: 1600, market: 400, value: 2000, marketShare: 0.2, cashedIn: 25 });
    expect(computeValueBreakdown(summary([row("a", 800, 1000, 1)])).marketShare).toBe(0);
  });

  it("legge la concentrazione", () => {
    expect(computeConcentration([row("a", 1, 1, 1)])?.kind).toBe("single");
    expect(computeConcentration([row("a", 1, 1, 0.79), row("b", 1, 1, 0.21)])).toEqual({ kind: "dominant", name: "a", share: 0.79 });
    const spread = computeConcentration([row("a", 1, 1, 0.3), row("b", 1, 1, 0.3), row("c", 1, 1, 0.2), row("d", 1, 1, 0.2)]);
    expect(spread?.kind).toBe("spread");
    expect(spread?.share).toBeCloseTo(0.8);
    expect(computeConcentration([])).toBeNull();
  });

  it("calcola l'esposizione a valute diverse da quella dell'utente", () => {
    expect(computeCurrencyExposure([{ key: "EUR", value: 79, share: 0.79 }, { key: "USD", value: 21, share: 0.21 }], "EUR")).toBeCloseTo(0.21);
  });

  it("conta i giorni di calendario fino a una data", () => {
    expect(daysUntil(new Date(2026, 9, 5), new Date(2026, 8, 28))).toBe(7);
  });
});
