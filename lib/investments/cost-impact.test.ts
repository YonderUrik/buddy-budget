import { expect, it } from "vitest";
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, type InvestmentTransactionInput } from "@/lib/calc/investments";
import { computeCostImpact, simulateCostExclusions } from "./cost-impact";

const tx = (extra: Partial<InvestmentTransactionInput>): InvestmentTransactionInput => ({
  id: "buy", instrumentId: "a", type: "acquisto", date: "2026-01-01", quantity: "10", price: "100", fxRate: "1", fees: "10", taxes: "0", grossAmount: null, ...extra,
});
function inputs(transactions: InvestmentTransactionInput[]) {
  return { transactions, instruments: [{ id: "a", name: "Stock", type: "azione" as const, currency: "EUR", priceUnit: "unita" as const }],
    priceIndex: buildPriceIndex([{ instrumentId: "a", date: "2026-01-01", close: "100", source: "yahoo" }, { instrumentId: "a", date: "2026-02-01", close: "110", source: "yahoo" }], []),
    fx: buildFxTable([]), userCurrency: "EUR", period: "max" as const, today: new Date("2026-02-01T12:00:00Z") };
}
it("reinvests saved costs and taxes from payment date at subsequent actual performance", () => {
  const params = inputs([tx({ taxes: "5" })]);
  const result = computeCostImpact(params, false);
  expect(result.fees).toBe(10);
  expect(result.taxes).toBe(5);
  expect(result.additions["2026-01-01"]).toEqual({ fees: 10, taxes: 5 });
  expect(result.additions["2026-02-01"].fees).toBeCloseTo(11);
  expect(result.additions["2026-02-01"].taxes).toBeCloseTo(5.5);
});
it("supports all four independent toggle combinations without changing actual data", () => {
  const impact = computeCostImpact(inputs([tx({ taxes: "5" })]), false);
  const series = [{ date: "2026-02-01", label: "Feb", value: 1100, bought: 1015, invested: 1015, income: 0 }];
  expect(simulateCostExclusions(impact, series, 1100, true, true).value).toBe(1100);
  expect(simulateCostExclusions(impact, series, 1100, false, true).value).toBeCloseTo(1111);
  expect(simulateCostExclusions(impact, series, 1100, true, false).value).toBeCloseTo(1105.5);
  const both = simulateCostExclusions(impact, series, 1100, false, false);
  expect(both.value).toBeCloseTo(1116.5);
  expect(both.series[0].value).toBe(both.value);
  expect(series[0].value).toBe(1100);
  expect(both.series[0].invested).toBe(1015);
});
it("keeps the same lifetime simulated value when changing the chart window", () => {
  const params = inputs([tx({ date: "2025-01-01" })]);
  expect(computeCostImpact({ ...params, period: "1mese" }, false).additions).toEqual(computeCostImpact(params, false).additions);
});
it("preserves signed refunds, excludes future and noncash charges, and does not convert charges again", () => {
  const params = inputs([tx({ fxRate: "2" }), tx({ id: "future", date: "2027-01-01", fees: "100" }), tx({ id: "adjust", type: "rettifica", fees: "50" }), tx({ id: "refund", type: "dividendo", date: "2026-02-01", quantity: "0", fees: "-2", taxes: "-1", grossAmount: "0" })]);
  const result = computeCostImpact(params, false);
  expect(result.fees).toBe(8);
  expect(result.taxes).toBe(-1);
});
it("disables simulation without valuation data", () => {
  const impact = computeCostImpact(inputs([tx({})]), true);
  expect(impact.available).toBe(false);
  expect(simulateCostExclusions(impact, [], 1000, false, false).value).toBe(1000);
  expect(computeCostImpact(inputs([]), false).available).toBe(false);
});
it("retains saved money when the actual portfolio is fully sold and no return is observable", () => {
  const params = inputs([tx({}), tx({ id: "sell", type: "vendita", date: "2026-01-02", fees: "0" })]);
  const result = computeCostImpact(params, false);
  expect(result.additions["2026-02-01"].fees).toBeCloseTo(10);
});
it("saved money also follows portfolio losses rather than earning a fixed positive return", () => {
  const params = inputs([tx({ taxes: "5" })]);
  params.priceIndex = buildPriceIndex([{ instrumentId: "a", date: "2026-01-01", close: "100", source: "yahoo" }, { instrumentId: "a", date: "2026-02-01", close: "80", source: "yahoo" }], []);
  const result = computeCostImpact(params, false);
  expect(result.additions["2026-02-01"].fees).toBeCloseTo(8);
  expect(result.additions["2026-02-01"].taxes).toBeCloseTo(4);
});
