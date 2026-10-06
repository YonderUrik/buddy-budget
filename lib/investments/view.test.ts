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
  statementAccountKey: null,
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

it("uses the Taxes tab report including loss offsets, carryforwards and instrument rates", async () => {
  const { buildTaxView } = await import("./tax-view");
  const input = data();
  input.instruments[0].type = "azione";
  const buy = input.transactions[0];
  input.transactions = [buy,
    { ...buy, id: "loss", type: "vendita", date: "2026-09-02", quantity: "5", price: "80" },
    { ...buy, id: "profit", type: "vendita", date: "2026-09-03", quantity: "5", price: "140" },
  ];
  // Loss 100 offsets gain 200: only 100 is taxable.
  expect(buildTaxView(input, NOW).report.years[0].estimatedTax).toBeCloseTo(26);
  expect(buildInvestmentsView(input, "max", NOW).costImpact.estimatedTaxes).toBeCloseTo(26);
  input.taxCarryforwards = [{ id: "loss", year: 2025, amount: "100", note: null }];
  expect(buildInvestmentsView(input, "max", NOW).costImpact.estimatedTaxes).toBeCloseTo(0);
  input.taxCarryforwards = [];
  input.instrumentSettings = [{ instrumentId: "etf", taxRate: "0.125", taxHarmonized: true, couponRate: null, couponFrequency: null, maturityDate: null }];
  expect(buildInvestmentsView(input, "max", NOW).costImpact.estimatedTaxes).toBeCloseTo(buildTaxView(input, NOW).report.years[0].estimatedTax);
});

it("respects the same annual loss compensation as the Taxes tab in dichiarativo", async () => {
  const { buildTaxView } = await import("./tax-view");
  const input = data(); input.instruments[0].type = "azione";
  input.portfolios = [{ id: "p", userId: "u", name: "Portfolio", broker: null, statementCashAccountId: null, benchmarkInstrumentId: null, taxRegime: "dichiarativo", createdAt: NOW, updatedAt: NOW }];
  const buy = input.transactions[0];
  input.transactions = [buy,
    { ...buy, id: "profit", type: "vendita", date: "2026-09-02", quantity: "5", price: "140" },
    { ...buy, id: "loss", type: "vendita", date: "2026-09-03", quantity: "5", price: "80" },
  ];
  const view = buildInvestmentsView(input, "max", NOW);
  expect(view.costImpact.estimatedTaxes).toBeCloseTo(26);
  expect(view.costImpact.estimatedTaxes).toBeCloseTo(buildTaxView(input, NOW).report.years[0].estimatedTax);
  expect(view.costImpact.additions["2026-09-03"].estimatedTaxes).toBe(0);
  expect(view.costImpact.additions["2026-09-20"].estimatedTaxes).toBeCloseTo(26);
});
