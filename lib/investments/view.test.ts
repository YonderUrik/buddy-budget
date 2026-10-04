import { describe, expect, it } from "vitest";
import type { InvestmentData } from "./data";
import { buildInvestmentsView, usedInstruments } from "./view";

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
    dividendsFetchedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
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
    prices: [{ instrumentId: "etf", date: "2026-09-18", close: "110", source: "yahoo" }],
    manualPrices: [],
    fxRates: [],
    benchmark: null,
    inflation: [],
    targets: [],
    profiles: [],
    manualBreakdowns: [],
    riskFreeRates: [],
    instrumentSettings: [],
    taxCarryforwards: [],
    dividends: [],
    dismissedDividends: [],
  };
}

describe("buildInvestmentsView", () => {
  it("calcola riepilogo, serie, composizione ", () => {
    const view = buildInvestmentsView(data(), "1mese", NOW);
    expect(view.summary.totalValue).toBeCloseTo(1100);
    expect(view.series.at(-1)?.value).toBeCloseTo(1100);
    expect(view.byType).toEqual([{ key: "etf", value: 1100, share: 1 }]);
    expect(view.hasTransactions).toBe(true);
  });

  it("propone gli strumenti già usati, dal più recente", () => {
    const base = data().instruments[0];
    const byId = new Map(["a", "b", "c"].map((id) => [id, { ...base, id }]));
    const used = usedInstruments(
      [
        { instrumentId: "a", date: "2026-01-10" },
        { instrumentId: "b", date: "2026-09-01" },
        { instrumentId: "a", date: "2026-03-01" },
        { instrumentId: "sparito", date: "2026-09-10" },
      ],
      byId
    );
    expect(used.map((i) => i.id)).toEqual(["b", "a"]);
    expect(buildInvestmentsView(data(), "1mese", NOW).usedInstruments.map((i) => i.id)).toEqual(["etf"]);
  });
});
