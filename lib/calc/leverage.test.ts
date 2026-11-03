import { describe, expect, it } from "vitest";
import { buildFxTable } from "./fx";
import { buildPriceIndex, type InstrumentInput, type InvestmentTransactionInput } from "./investments";
import { buildCashSeries, computeBrokerLeverage, eachDay, marginCallDrop, toCapitalFlows, type LeverageSource } from "./leverage";
import { computePortfolioReturns } from "./returns";

const EUR_ONLY = buildFxTable([]);

/** One January statement: 10,000 paid in, 15,000 of shares bought on margin, 20 of debit interest at the end of the month. */
const SOURCE: LeverageSource = {
  accountId: "cash", accountKey: "U1", provider: "interactive-brokers", name: "Interactive Brokers · liquidità U1",
  statements: [{
    from: "2025-01-01", to: "2025-01-31",
    opening: [{ currency: "EUR", amount: 0 }],
    closing: [{ currency: "EUR", amount: -5020 }],
    moves: [
      { date: "2025-01-02", currency: "EUR", amount: 10000, kind: "deposit" },
      { date: "2025-01-03", currency: "EUR", amount: -15000, kind: "other" },
      { date: "2025-01-31", currency: "EUR", amount: -20, kind: "interest" },
    ],
  }],
};

describe("buildCashSeries", () => {
  it("rebuilds the cash day by day, with the day's deposits, interest and borrowed amount", () => {
    const dates = ["2024-12-31", "2025-01-02", "2025-01-03", "2025-01-31", "2025-02-15"];
    const series = buildCashSeries([SOURCE], EUR_ONLY, "EUR", dates);
    expect(series.cash).toEqual([0, 10000, -5000, -5020, -5020]);
    expect(series.deposits).toEqual([0, 10000, 0, 0, 0]);
    expect(series.interest).toEqual([0, 0, 0, 20, 0]);
    expect(series.borrowed).toEqual([0, 0, 5000, 5020, 5020]);
    expect(series.missingFx).toBe(false);
  });

  it("counts only the negative currencies as borrowed, each at the day's rate", () => {
    const fx = buildFxTable([{ date: "2025-01-01", currency: "USD", perEur: "1.25" }]);
    const source: LeverageSource = { ...SOURCE, statements: [{ from: "2025-01-01", to: "2025-01-31", opening: [{ currency: "EUR", amount: 3000 }, { currency: "USD", amount: -5000 }], closing: [{ currency: "EUR", amount: 3000 }, { currency: "USD", amount: -5000 }], moves: [] }] };
    const series = buildCashSeries([source], fx, "EUR", ["2025-01-10"]);
    expect(series.cash[0]).toBeCloseTo(3000 - 4000);
    expect(series.borrowed[0]).toBeCloseTo(4000);
  });

  it("does not count earlier movements as the first day's deposits", () => {
    const series = buildCashSeries([SOURCE], EUR_ONLY, "EUR", ["2025-01-10"]);
    expect(series.cash).toEqual([-5000]);
    expect(series.deposits).toEqual([0]);
  });
});

describe("computeBrokerLeverage", () => {
  it("values the loan against today's securities and annualises the interest over the days seen", () => {
    const leverage = computeBrokerLeverage(SOURCE, 16000, EUR_ONLY, "EUR", "2025-03-01")!;
    expect(leverage).toMatchObject({ statementDate: "2025-01-31", netCash: -5020, loan: 5020, equity: 10980 });
    expect(leverage.ratio).toBeCloseTo(16000 / 10980);
    expect(leverage.loanToValue).toBeCloseTo(5020 / 16000);
    expect(leverage.interest.byYear).toEqual([{ year: 2025, amount: 20 }]);
    // 3–30 January borrowed 5,000, the 31st 5,020, the first two days nothing.
    const average = (28 * 5000 + 5020) / 31;
    expect(leverage.interest.averageBorrowed).toBeCloseTo(average);
    expect(leverage.interest.effectiveRate).toBeCloseTo((20 / average) * (365 / 31));
  });

  it("has no ratio when the own capital is gone", () => {
    expect(computeBrokerLeverage(SOURCE, 5000, EUR_ONLY, "EUR", "2025-03-01")!.ratio).toBeNull();
  });
});

describe("marginCallDrop", () => {
  it("is the fall that brings the own capital to the maintenance margin", () => {
    // 16,000 of securities, 5,000 borrowed, 25%: 16,000 · (1 − x) · 0.75 = 5,000.
    expect(marginCallDrop(5000, 16000, 0.25)).toBeCloseTo(1 - 5000 / 12000);
    expect(marginCallDrop(13000, 16000, 0.25)).toBe(0);
    expect(marginCallDrop(0, 16000, 0.25)).toBeNull();
  });
});

describe("toCapitalFlows", () => {
  it("replaces the account's buys with its deposits and adds its cash to the value", () => {
    const cash = { cash: [0, 10000, -5000], deposits: [0, 10000, 0], interest: [0, 0, 0], borrowed: [0, 0, 5000], missingFx: false };
    const all = [{ date: "d1", value: 0, inflow: 0, outflow: 0, income: 0 }, { date: "d2", value: 15000, inflow: 15000, outflow: 0, income: 0 }];
    const own = toCapitalFlows(0, all, all, cash);
    expect(own.baseValue).toBe(0);
    expect(own.flows).toEqual([
      { date: "d1", value: 10000, inflow: 10000, outflow: 0, income: 0 },
      { date: "d2", value: 10000, inflow: 0, outflow: 0, income: 0 },
    ]);
  });
});

describe("computePortfolioReturns with capital", () => {
  const ETF: InstrumentInput = { id: "etf", name: "ETF", type: "etf", currency: "EUR", priceUnit: "unita" };
  const buy: InvestmentTransactionInput = { id: "b1", instrumentId: "etf", type: "acquisto", date: "2025-01-03", quantity: "1500", price: "10", fxRate: "1", fees: "0", taxes: "0", grossAmount: null };
  const priceIndex = buildPriceIndex(eachDay("2025-01-03", "2025-02-28").map((date) => ({ instrumentId: "etf", date, close: "10", source: "yahoo" as const })), [], [buy]);
  const common = { transactions: [buy], instruments: [ETF], priceIndex, fx: EUR_ONLY, userCurrency: "EUR", period: "max" as const, today: new Date(2025, 1, 28) };

  it("flat prices: zero on the securities, the interest on the own capital", () => {
    expect(computePortfolioReturns(common)!.twr).toBeCloseTo(0);
    const own = computePortfolioReturns({ ...common, range: { from: "2025-01-01", to: "2025-02-28" }, capital: { transactions: [buy], sources: [SOURCE] } })!;
    expect(own.twr).toBeCloseTo(-20 / 10000, 6);
  });
});
