import { describe, expect, it } from "vitest";
import type { CompanyStatements } from "@/lib/market-data/statements";
import { computeAnnualReturns, computeDividendFacts, computeStockFundamentals, terCost } from "./title-fundamentals";

const SHARES = 1_000;

function year(end: string, revenue: number, netIncome: number, extra: Record<string, number> = {}) {
  return {
    end,
    values: {
      revenue, netIncome, dilutedShares: SHARES, sharesOutstanding: SHARES, equity: 5_000, totalDebt: 4_000, cash: 1_000,
      ebitda: 2_000, freeCashFlow: 800, grossProfit: revenue * 0.4, operatingIncome: revenue * 0.15, totalAssets: 20_000,
      currentAssets: 3_000, currentLiabilities: 2_500, interestExpense: -300, dividendsPaid: -400, ...extra,
    },
  };
}

const STATEMENTS: CompanyStatements = {
  currency: "EUR",
  annual: [year("2022-12-31", 8_000, 500), year("2023-12-31", 9_000, 600), year("2024-12-31", 10_000, 1_000), year("2025-12-31", 11_000, 1_100)],
  trailing: year("2026-06-30", 12_000, 1_200),
};

const CLOSES = [
  { date: "2022-12-30", close: 10 },
  { date: "2023-12-29", close: 12 },
  { date: "2024-12-31", close: 15 },
  { date: "2025-12-31", close: 22 },
  { date: "2026-10-09", close: 24 },
];

describe("computeStockFundamentals", () => {
  const result = computeStockFundamentals(STATEMENTS, CLOSES, "EUR")!;

  it("calcola i multipli di oggi con l'ultima chiusura e gli ultimi 12 mesi", () => {
    // utile per azione 1,2 → P/E 24 / 1,2 = 20
    expect(result.valuation.pe?.value).toBeCloseTo(20);
    expect(result.valuation.pe?.numerator).toEqual({ label: "Prezzo", value: 24, unit: "price" });
    expect(result.valuation.ps?.value).toBeCloseTo(24 / 12);
    expect(result.valuation.pb?.value).toBeCloseTo(24 / 5);
    expect(result.valuation.pfcf?.value).toBeCloseTo(24 / 0.8);
    // EV = 24·1000 + 4000 − 1000 = 27000; / 2000
    expect(result.valuation.evEbitda?.value).toBeCloseTo(13.5);
    expect(result.valuation.earningsYield?.value).toBeCloseTo(0.05);
  });

  it("dà la forbice storica del P/E sugli esercizi con una chiusura di fine anno", () => {
    // 10/0,5 = 20, 12/0,6 = 20, 15/1 = 15, 22/1,1 = 20
    expect(result.valuation.pe?.history).toEqual({ min: 15, max: 20, average: 18.75, years: 4 });
  });

  it("mette gli ultimi 12 mesi come ultima colonna e calcola i valori per azione", () => {
    expect(result.columns.map((c) => c.label)).toEqual(["2022", "2023", "2024", "2025", "12 mesi"]);
    expect(result.perShare.revenue).toEqual([8, 9, 10, 11, 12]);
    expect(result.perShare.dividend[4]).toBeCloseTo(0.4);
  });

  it("calcola margini, crescita, redditività e solidità", () => {
    expect(result.margins.net?.value).toBeCloseTo(0.1);
    expect(result.growth.lastYear).toBeCloseTo(0.1);
    expect(result.growth.average).toBeCloseTo((11_000 / 8_000) ** (1 / 3) - 1);
    expect(result.profitability.roe?.value).toBeCloseTo(1_200 / 5_000);
    expect(result.profitability.interestCoverage?.value).toBeCloseTo(1_800 / 300);
    expect(result.solidity.netDebtToEbitda?.value).toBeCloseTo(1.5);
    expect(result.solidity.payout?.value).toBeCloseTo(400 / 1_200);
  });

  it("non calcola P/E con utili negativi né multipli con valute diverse", () => {
    const loss = computeStockFundamentals({ ...STATEMENTS, trailing: year("2026-06-30", 12_000, -100) }, CLOSES, "EUR")!;
    expect(loss.valuation.pe).toBeUndefined();
    const usd = computeStockFundamentals(STATEMENTS, CLOSES, "USD")!;
    expect(usd.priceComparable).toBe(false);
    expect(usd.valuation).toEqual({});
    expect(usd.perShare.revenue[0]).toBe(8);
  });

  it("senza la chiusura di fine esercizio non c'è forbice storica", () => {
    const short = computeStockFundamentals(STATEMENTS, CLOSES.slice(-2), "EUR")!;
    expect(short.valuation.pe?.history).toBeNull();
  });
});

describe("computeDividendFacts", () => {
  const dividends = [
    { exDate: "2021-07-20", amount: 0.2 },
    { exDate: "2022-07-20", amount: 0.22 },
    { exDate: "2023-07-20", amount: 0.24 },
    { exDate: "2024-07-20", amount: 0.26 },
    { exDate: "2025-07-20", amount: 0.28 },
    { exDate: "2026-01-20", amount: 0.15 },
  ];

  it("somma per anno, calcola rendimento, rendimento sul prezzo medio e crescita", () => {
    const facts = computeDividendFacts({ dividends, lastClose: 5, averagePrice: 4, announcedExDate: "2027-01-20", today: "2026-10-11" })!;
    expect(facts.perYear.map((y) => y.year)).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    expect(facts.perYear[5]).toEqual({ year: 2026, amount: 0.15, partial: true });
    expect(facts.trailing).toBeCloseTo(0.15);
    expect(facts.yieldToday).toBeCloseTo(0.03);
    expect(facts.yieldOnCost).toBeCloseTo(0.0375);
    expect(facts.growth).toBeCloseTo((0.28 / 0.2) ** (1 / 4) - 1);
    expect(facts.nextExDate).toBe("2027-01-20");
  });

  it("restituisce null senza dividendi e ignora uno stacco annunciato già passato", () => {
    expect(computeDividendFacts({ dividends: [], lastClose: 5, averagePrice: null, announcedExDate: null, today: "2026-10-11" })).toBeNull();
    const facts = computeDividendFacts({ dividends, lastClose: 5, averagePrice: null, announcedExDate: "2026-01-20", today: "2026-10-11" })!;
    expect(facts.nextExDate).toBeNull();
    expect(facts.yieldOnCost).toBeNull();
  });
});

describe("computeAnnualReturns", () => {
  it("calcola gli anni interi e l'anno in corso fino all'ultima chiusura", () => {
    expect(computeAnnualReturns(CLOSES)).toEqual([
      { year: 2023, value: expect.closeTo(0.2), partial: false },
      { year: 2024, value: expect.closeTo(0.25), partial: false },
      { year: 2025, value: expect.closeTo(22 / 15 - 1), partial: false },
      { year: 2026, value: expect.closeTo(24 / 22 - 1), partial: true },
    ]);
  });

  it("salta un anno senza la chiusura di fine anno precedente", () => {
    expect(computeAnnualReturns([{ date: "2025-06-01", close: 10 }, { date: "2026-03-01", close: 11 }])).toEqual([]);
  });
});

describe("terCost", () => {
  it("è zero senza costi e cresce con gli anni", () => {
    expect(terCost(0, 10)).toBeCloseTo(0);
    expect(terCost(0.0022, 10)).toBeCloseTo(10_000 * (1.05 ** 10 - (1.05 * 0.9978) ** 10));
    expect(terCost(0.0022, 20)).toBeGreaterThan(terCost(0.0022, 10));
  });
});
