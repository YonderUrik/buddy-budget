import { describe, expect, it } from "vitest";
import type { InvestmentData } from "./data";
import { buildInvestmentsView } from "./view";
import { filterInvestmentBrokers, investmentBrokerGroups, transactionBroker } from "./broker-filter";
import { brokerComparison } from "./broker-comparison";
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

function mixed(): InvestmentData {
  const result = data();
  result.brokerSources = [{ accountKey: "ib", provider: "interactive-brokers" }, { accountKey: "dg", provider: "degiro" }];
  result.transactions[0].statementAccountKey = "ib";
  result.transactions.push({ ...result.transactions[0], id: "t2", statementAccountKey: "dg", quantity: "5" });
  return result;
}
describe("broker selection and comparison", () => {
  it("separates brokers sharing a portfolio and instrument without mutating the original", () => {
    const original = mixed(); const copy = structuredClone(original);
    expect(investmentBrokerGroups(original).map((g) => g.id).sort()).toEqual(["degiro", "interactive-brokers"]);
    const filtered = filterInvestmentBrokers(original, new Set(["degiro"]));
    expect(filtered.transactions.map((t) => t.id)).toEqual(["t1"]);
    expect(buildInvestmentsView(original, "1mese", NOW).summary.totalValue).toBeCloseTo(1650);
    expect(buildInvestmentsView(filtered, "1mese", NOW).summary.totalValue).toBeCloseTo(1100);
    expect(original).toEqual(copy);
  });
  it("supports all brokers disabled and restores the original combined view", () => {
    const original = mixed();
    const empty = filterInvestmentBrokers(original, new Set(["degiro", "interactive-brokers"]));
    expect(empty.transactions).toEqual([]); expect(empty.instruments).toEqual([]);
    expect(buildInvestmentsView(empty, "1mese", NOW).hasTransactions).toBe(false);
    expect(filterInvestmentBrokers(original, new Set())).toBe(original);
  });
  it("identifies dedicated legacy IBKR history and keeps unidentified imports separately selectable", () => {
    const legacy = data();
    expect(transactionBroker(legacy, legacy.transactions[0])).toBe("manual");
    legacy.portfolios = [{ id: "p", userId: "u", name: "Legacy", broker: "ibkr:key", statementCashAccountId: null, benchmarkInstrumentId: null, taxRegime: "dichiarativo", createdAt: NOW, updatedAt: NOW }];
    expect(transactionBroker(legacy, legacy.transactions[0])).toBe("interactive-brokers");
    legacy.transactions[0].statementAccountKey = "unknown";
    expect(transactionBroker(legacy, legacy.transactions[0])).toBe("source:unknown");
  });
  it("does not invent zero-return history before a broker first appears", () => {
    const input = mixed(); input.transactions[1].date = "2026-09-10";
    const result = brokerComparison(input, "max", NOW);
    const degiro = result.lines.find((line) => line.label === "DEGIRO")!;
    const early = result.points.filter((point) => point.date < "2026-09-10");
    expect(early.length).toBeGreaterThan(0);
    expect(early.every((point) => point[degiro.key] === undefined)).toBe(true);
  });
  it("overlays percentage returns and recalculates the combined return instead of adding percentages", () => {
    const comparison = brokerComparison(mixed(), "1mese", NOW);
    expect(comparison.lines).toHaveLength(3);
    for (const line of comparison.lines) expect(line.twr).toBeCloseTo(0.1);
    const final = comparison.points.at(-1)!;
    expect(final.combined).toBeCloseTo(10);
    expect(comparison.points.map((p) => p.date)).toEqual(comparison.points.map((p) => p.date).sort());
    expect(brokerComparison(filterInvestmentBrokers(mixed(), new Set(["degiro"])), "1mese", NOW).lines.map((l) => l.label)).toEqual(["Interactive Brokers"]);
  });
});
