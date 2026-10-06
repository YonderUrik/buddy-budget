import { expect, it } from "vitest";
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, type InvestmentTransactionInput } from "@/lib/calc/investments";
import { computePortfolioReturns } from "@/lib/calc/returns";
import { computeCostImpact } from "./cost-impact";

const tx = (extra: Partial<InvestmentTransactionInput>): InvestmentTransactionInput => ({
  id: "buy", instrumentId: "a", type: "acquisto", date: "2026-01-01", quantity: "10", price: "100", fxRate: "1", fees: "10", taxes: "0", grossAmount: null, ...extra,
});
function inputs(transactions: InvestmentTransactionInput[]) {
  return { transactions, instruments: [{ id: "a", name: "Stock", type: "azione" as const, currency: "EUR", priceUnit: "unita" as const }],
    priceIndex: buildPriceIndex([{ instrumentId: "a", date: "2026-01-01", close: "100", source: "yahoo" }, { instrumentId: "a", date: "2026-02-01", close: "110", source: "yahoo" }], []),
    fx: buildFxTable([]), userCurrency: "EUR", period: "max" as const, today: new Date("2026-02-01T12:00:00Z") };
}
it("shows exact charges and compounded gross/net impact without deducting twice", () => {
  const params = inputs([tx({}), tx({ id: "div", type: "dividendo", date: "2026-02-01", quantity: "0", price: "0", fees: "0", taxes: "5", grossAmount: "20" })]);
  const original = structuredClone(params.transactions);
  const net = computePortfolioReturns(params)!.twr!;
  const result = computeCostImpact(params, net, false);
  expect(result.period).toEqual({ fees: 10, taxes: 5, total: 15 });
  expect(result.grossReturn).toBeCloseTo(.12);
  expect(result.netReturn).toBe(net);
  expect(result.feeImpact! + result.taxImpact!).toBeCloseTo(result.totalImpact!);
  expect(result.totalImpact).toBeLessThan(0);
  expect(params.transactions).toEqual(original);
});
it("uses user-currency charges once and excludes future and noncash adjustments", () => {
  const params = inputs([tx({ fxRate: "2" }), tx({ id: "future", date: "2027-01-01", fees: "100" }), tx({ id: "adjust", type: "rettifica", fees: "50" })]);
  expect(computeCostImpact(params, null, true).lifetime.fees).toBe(10);
  expect(computeCostImpact(params, null, true).totalImpact).toBeNull();
});
it("separates period charges from lifetime and preserves signed refunds", () => {
  const params = { ...inputs([tx({ date: "2025-01-01" }), tx({ id: "refund", type: "dividendo", date: "2026-02-01", quantity: "0", fees: "-2", taxes: "-1", grossAmount: "0" })]), period: "1mese" as const };
  const result = computeCostImpact(params, computePortfolioReturns(params)!.twr, false);
  expect(result.period).toEqual({ fees: -2, taxes: -1, total: -3 });
  expect(result.lifetime).toEqual({ fees: 8, taxes: -1, total: 7 });
  expect(result.totalImpact).toBeGreaterThan(0);
});
it("shows zero impact with no charges and handles no operations", () => {
  const params = inputs([tx({ fees: "0" })]);
  expect(computeCostImpact(params, computePortfolioReturns(params)!.twr, false).totalImpact).toBe(0);
  expect(computeCostImpact(inputs([]), null, false).grossReturn).toBeNull();
});
it("includes sale charges after full liquidation and keeps prior-period charges out of the impact", () => {
  const params = { ...inputs([tx({ date: "2025-01-01", fees: "100" }), tx({ id: "sell", type: "vendita", date: "2026-02-01", price: "110", fees: "2", taxes: "20" })]), period: "1mese" as const };
  const result = computeCostImpact(params, computePortfolioReturns(params)!.twr, false);
  expect(result.period.total).toBe(22);
  expect(result.lifetime.total).toBe(122);
  expect(result.grossReturn).toBeCloseTo(.1);
  expect(result.netReturn).toBeCloseTo(.078);
  expect(result.totalImpact).toBeCloseTo(-.022);
});
