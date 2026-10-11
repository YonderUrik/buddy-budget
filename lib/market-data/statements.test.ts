import { describe, expect, it } from "vitest";
import { normalizeHoldingsMultiples } from "./providers/yahoo";
import { parseYahooStatements, statementTypes } from "./statements";

const point = (asOfDate: string, raw: number) => ({ asOfDate, currencyCode: "EUR", periodType: "12M", reportedValue: { raw } });

describe("statementTypes", () => {
  it("chiede annuali per tutto, trailing per conto economico e cassa, trimestrali per lo stato patrimoniale", () => {
    const types = statementTypes();
    expect(types).toContain("annualTotalRevenue");
    expect(types).toContain("trailingTotalRevenue");
    expect(types).toContain("quarterlyStockholdersEquity");
    expect(types).not.toContain("trailingStockholdersEquity");
  });
});

describe("parseYahooStatements", () => {
  it("raggruppa per esercizio e compone gli ultimi 12 mesi con l'ultimo trimestre", () => {
    const body = {
      timeseries: {
        result: [
          { meta: { type: ["annualTotalRevenue"] }, annualTotalRevenue: [point("2024-12-31", 100), null, point("2025-12-31", 120)] },
          { meta: { type: ["annualStockholdersEquity"] }, annualStockholdersEquity: [point("2024-12-31", 50), point("2025-12-31", 55)] },
          { meta: { type: ["trailingTotalRevenue"] }, trailingTotalRevenue: [point("2026-06-30", 130)] },
          { meta: { type: ["trailingNetIncomeCommonStockholders"] }, trailingNetIncomeCommonStockholders: [point("2026-03-31", 9)] },
          { meta: { type: ["quarterlyStockholdersEquity"] }, quarterlyStockholdersEquity: [point("2026-03-31", 57), point("2026-06-30", 58)] },
          { meta: { type: ["annualSomethingElse"] }, annualSomethingElse: [point("2025-12-31", 1)] },
        ],
      },
    };
    const parsed = parseYahooStatements(body)!;
    expect(parsed.currency).toBe("EUR");
    expect(parsed.annual).toEqual([
      { end: "2024-12-31", values: { revenue: 100, equity: 50 } },
      { end: "2025-12-31", values: { revenue: 120, equity: 55 } },
    ]);
    // L'utile fermo al trimestre prima non si mescola con i ricavi più recenti.
    expect(parsed.trailing).toEqual({ end: "2026-06-30", values: { revenue: 130, equity: 58 } });
  });

  it("restituisce null senza esercizi annuali", () => {
    expect(parseYahooStatements({ timeseries: { result: [] } })).toBeNull();
    expect(parseYahooStatements({})).toBeNull();
  });
});

describe("normalizeHoldingsMultiples", () => {
  it("inverte i multipli dati come utili/prezzo e lascia quelli già diretti", () => {
    const inverted = normalizeHoldingsMultiples(0.05, 0.25, 0.5);
    expect(inverted.pe).toBeCloseTo(20);
    expect(inverted.pb).toBeCloseTo(4);
    expect(inverted.ps).toBeCloseTo(2);
    expect(normalizeHoldingsMultiples(19.8, 2.9, 2.2)).toEqual({ pe: 19.8, pb: 2.9, ps: 2.2 });
    expect(normalizeHoldingsMultiples(null, 0, null)).toEqual({ pe: null, pb: null, ps: null });
  });
});
