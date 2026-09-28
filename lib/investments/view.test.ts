import { describe, expect, it } from "vitest";
import type { InvestmentData } from "./data";
import { buildInvestmentsView } from "./view";

const NOW = new Date("2026-09-20T12:00:00Z");

function data(): InvestmentData {
  const instrument = {
    id: "etf",
    isin: "IE00BK5BQT80",
    name: "VWCE",
    type: "etf" as const,
    currency: "EUR",
    priceMode: "auto" as const,
    priceUnit: "unita" as const,
    exchange: "GER",
    taxRate: "0.2600",
    taxHarmonized: true,
    createdByUserId: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const plan = (id: string, amount: string, frequency: "mensile" | "trimestrale", active: boolean) => ({
    id,
    userId: "u",
    portfolioId: "p",
    instrumentId: "etf",
    amount,
    frequency,
    dayOfMonth: 5,
    active,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return {
    currency: "EUR",
    portfolios: [],
    instruments: [instrument],
    transactions: [
      {
        id: "t1",
        userId: "u",
        portfolioId: "p",
        instrumentId: "etf",
        type: "acquisto",
        date: "2026-09-01",
        quantity: "10.0000000000",
        price: "100.00000000",
        fxRate: "1.00000000",
        fees: "0.00",
        taxes: "0.00",
        grossAmount: null,
        note: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    plans: [plan("a", "200.00", "mensile", true), plan("b", "300.00", "trimestrale", true), plan("c", "999.00", "mensile", false)],
    prices: [{ instrumentId: "etf", date: "2026-09-18", close: "110", source: "yahoo" }],
    manualPrices: [],
    fxRates: [],
  };
}

describe("buildInvestmentsView", () => {
  it("calcola riepilogo, serie, composizione e importo mensile dei PAC attivi", () => {
    const view = buildInvestmentsView(data(), "1mese", NOW);
    expect(view.summary.totalValue).toBeCloseTo(1100);
    expect(view.series.at(-1)?.value).toBeCloseTo(1100);
    expect(view.byType).toEqual([{ key: "etf", value: 1100, share: 1 }]);
    expect(view.activePlans).toHaveLength(2);
    expect(view.monthlyPlanAmount).toBeCloseTo(300);
    expect(view.hasTransactions).toBe(true);
  });
});
