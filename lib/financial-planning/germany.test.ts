import { describe, expect, it } from "vitest";
import { germanPlanSchema, pensionPlanSchema, germanCapitalTax, germanFundAdvance, germanIncomeTax, germanCrypto, germanPortfolioReport, germanRetirement, projectGermanPension, germanIncomeForecast, germanRules } from ".";
import { planningModel } from "./registry";
import type { InvestmentData } from "@/lib/investments/data";
import type { InvestmentTransaction, Instrument } from "@/lib/db/schema/investments";
const plan = () => germanPlanSchema.parse({ tax: { historyConfirmed: true } });
const instrument = (patch: Partial<Instrument> = {}): Instrument => ({ id: "stock", name: "Stock", type: "azione", currency: "EUR", priceUnit: "unita", priceMode: "manuale", taxRate: "0.26", taxHarmonized: null, isin: null, exchange: null, dividendsFetchedAt: null, createdByUserId: null, createdAt: new Date(), updatedAt: new Date(), ...patch });
let id = 0;
const tx = (patch: Partial<InvestmentTransaction> = {}): InvestmentTransaction => ({ id: String(++id), userId: "u", instrumentId: "stock", portfolioId: "p", statementAccountKey: null, type: "acquisto", date: "2026-01-02", quantity: "10", price: "100", fxRate: "1", fees: "0", taxes: "0", grossAmount: null, note: null, createdAt: new Date(), updatedAt: new Date(), ...patch });
const data = (transactions: InvestmentTransaction[], instruments = [instrument()]): InvestmentData => ({ currency: "EUR", productCountry: "DE", instruments, transactions, portfolios: [], prices: [], manualPrices: [], fxRates: [], benchmark: null, inflation: [], targets: [], profiles: [], manualBreakdowns: [], riskFreeRates: [], instrumentSettings: [], taxCarryforwards: [], dividends: [], dismissedDividends: [] });

describe("German year-versioned capital tax", () => {
  it("has no fallback to Italy or an unvalidated year", () => { expect(planningModel("IT")).toBeNull(); expect(planningModel("US")).toBeNull(); expect(() => germanRules(2027)).toThrow(); });
  it.each([false, true])("applies the annual allowance once (joint=%s)", joint => {
    const p = { ...plan().tax, joint };
    expect(germanCapitalTax(p, 0, joint ? 2000 : 1000).total).toBe(0);
    expect(germanCapitalTax(p, 0, (joint ? 2000 : 1000) + 1000).total).toBe(263.75);
  });
  it.each([0.08, 0.09] as const)("uses the church-tax denominator for %s", churchRate => {
    const result = germanCapitalTax({ ...plan().tax, churchRate, allowanceUsedElsewhere: 1000 }, 1000, 0);
    expect(result.capitalTax).toBeCloseTo(1000 / (4 + churchRate), 2);
    expect(result.church).toBe(Math.round((result.capitalTax * churchRate + Number.EPSILON) * 100) / 100);
  });
  it("applies only a confirmed capped foreign credit and church-tax denominator", () => {
    const result = germanCapitalTax({ ...plan().tax, allowanceUsedElsewhere: 1000, verifiedForeignCredit: 150, churchRate: .09 }, 0, 1000);
    expect(result.capitalTax).toBe(97.80); expect(result.foreignCredit).toBe(150);
    expect(germanCapitalTax({ ...plan().tax, verifiedForeignCredit: 5000 }, 0, 2000).total).toBe(0);
  });
  it("does not offset share losses against dividends or expire them after four years", () => {
    const result = germanCapitalTax({ ...plan().tax, shareLosses: 4000, allowanceUsedElsewhere: 1000 }, 1000, 2000);
    expect(result.remainingShareLosses).toBe(3000); expect(result.taxable).toBe(2000);
  });
  it("offsets general losses against residual shares and other income before the allowance", () => {
    const result = germanCapitalTax({ ...plan().tax, generalLosses: 1000 }, 1000, 500);
    expect(result.total).toBe(0); expect(result.remainingAllowance).toBe(500);
  });
  it("never treats recorded withholding as a deduction from taxable dividends", () => {
    const report = germanPortfolioReport(data([tx({ type: "dividendo", grossAmount: "2000", quantity: "0", taxes: "500", fees: "10" })]), plan().tax, "2026-12-31");
    expect(report.generalIncome).toBe(2000); expect(report.estimate?.total).toBe(263.75); expect(report.recordedTaxes).toBe(500);
  });
});
describe("German acquisition lots", () => {
  it("uses FIFO and buy/sell fees instead of weighted average", () => {
    const d = data([tx({ fees: "10" }), tx({ date: "2026-02-02", price: "200" }), tx({ date: "2026-03-02", type: "vendita", quantity: "12", price: "300", fees: "12" })]);
    const before = structuredClone(d); const report = germanPortfolioReport(d, plan().tax, "2026-12-31");
    expect(report.shareGains).toBe(2178); expect(report.estimate?.taxable).toBe(1178); expect(d).toEqual(before);
  });
  it("keeps custody accounts separate and refuses missing basis", () => {
    const report = germanPortfolioReport(data([tx({ statementAccountKey: "a" }), tx({ statementAccountKey: "b", type: "vendita" })]), plan().tax, "2026-12-31");
    expect(report.estimate).toBeNull(); expect(report.issues.some(i => i.reason === "missing-lots")).toBe(true);
  });
  it("adjusts quantities and basis consistently for splits", () => {
    const report = germanPortfolioReport(data([tx(), tx({ type: "split", date: "2026-02-01", quantity: "2" }), tx({ type: "vendita", date: "2026-03-01", quantity: "20", price: "60" })]), plan().tax, "2026-12-31");
    expect(report.shareGains).toBe(200);
  });
  it("uses trade FX and percentage-of-nominal bond prices", () => {
    const report = germanPortfolioReport(data([tx({ quantity: "10000", fxRate: "0.9" }), tx({ type: "vendita", date: "2026-03-01", quantity: "10000", price: "105", fxRate: "0.8" })], [instrument({ type: "obbligazione", currency: "USD", priceUnit: "percentuale_nominale" })]), plan().tax, "2026-12-31");
    expect(report.generalIncome).toBe(-600);
  });
  it("consumes prior-year sales but excludes their gains and future transactions", () => {
    const report = germanPortfolioReport(data([tx({ date: "2025-01-01" }), tx({ date: "2025-02-01", type: "vendita", quantity: "5", price: "200" }), tx({ date: "2026-02-01", type: "vendita", quantity: "5", price: "150" }), tx({ date: "2026-12-01", type: "vendita" })]), plan().tax, "2026-10-14");
    expect(report.shareGains).toBe(250); expect(report.issues).toEqual([]);
  });
  it.each(["history", "currency", "legacy", "unsupported"])("blocks incomplete/unsupported %s", reason => {
    const d = data([tx({ date: reason === "legacy" ? "2008-01-01" : "2026-01-01" }), tx({ type: reason === "unsupported" ? "rettifica" : "vendita", date: "2026-02-01" })]);
    if (reason === "currency") d.currency = "USD";
    const p = { ...plan().tax, historyConfirmed: reason !== "history" };
    const report = germanPortfolioReport(d, p, "2026-12-31"); expect(report.estimate).toBeNull(); expect(report.issues.some(i => i.reason === reason)).toBe(true);
  });
});
describe("German funds", () => {
  it.each([["equity", .7], ["mixed", .85], ["property", .4], ["foreign-property", .2], ["other", 1]] as const)("uses %s exemption after subtracting gross prior advances", (kind, share) => {
    const p = { ...plan().tax, fundHistoryConfirmed: true, fundKinds: { stock: kind }, priorAdvancesBySale: { sale: 100 } };
    const report = germanPortfolioReport(data([tx(), tx({ id: "sale", type: "vendita", date: "2026-03-01", price: "200" })], [instrument({ type: "etf" })]), p, "2026-12-31");
    expect(report.generalIncome).toBeCloseTo(900 * share); expect(report.issues).toEqual([]);
  });
  it("does not infer an ETF exemption from its name or silently default to zero", () => {
    const report = germanPortfolioReport(data([tx({ type: "dividendo", grossAmount: "100" })], [instrument({ type: "etf", name: "World Equity ETF" })]), plan().tax, "2026-12-31");
    expect(report.estimate).toBeNull(); expect(report.issues.map(i => i.reason)).toContain("classification");
  });
  it("caps the advance at growth, deducts distributions and reduces for purchase month", () => {
    const base = { kind: "equity" as const, startValue: 10000, endValue: 10500, distributions: 100, acquisitionMonth: 7 };
    expect(germanFundAdvance(base)).toEqual({ gross: 62, taxable: 43.4, receiptYear: 2027 });
    expect(germanFundAdvance({ ...base, endValue: 9900 }).gross).toBe(0);
    expect(germanFundAdvance({ ...base, distributions: 300 }).gross).toBe(0);
    expect(germanFundAdvance({ ...base, kind: "unknown" }).taxable).toBeNull();
  });
});
describe("German private crypto", () => {
  const withSale = (gain: number, acquired = "2025-10-14", sold = "2026-10-14") => ({ ...plan(), otherTaxableIncome: 50000, crypto: [{ id: "c", name: "BTC", acquired, sold, cost: 1000, proceeds: 1000 + gain, fees: 0 }] });
  it("exempts only holdings longer than one year, not the anniversary itself", () => {
    expect(germanCrypto(withSale(1000)).taxable).toBe(1000);
    expect(germanCrypto(withSale(1000, "2025-10-13")).taxable).toBe(0);
  });
  it("taxes all gains at the threshold and none below it", () => {
    expect(germanCrypto(withSale(999.99)).taxable).toBe(0); expect(germanCrypto(withSale(1000)).taxable).toBe(1000);
  });
  it("combines other private sales and carries losses without mixing capital tax baskets", () => {
    expect(germanCrypto({ ...withSale(500), cryptoOtherGains: 600, cryptoLossCarryforward: 200 }).taxable).toBe(900);
    expect(germanCrypto({ ...withSale(-500), cryptoLossCarryforward: 200 }).remainingLoss).toBe(700);
  });
  it("uses progressive income tax and splitting, not flat capital tax", () => {
    expect(germanIncomeTax(12348)).toBe(0); expect(germanIncomeTax(24696, true)).toBe(0);
    expect(germanIncomeTax(50000)).toBe(10548);
    expect(germanCrypto(withSale(1000)).incomeTax).toBe(germanIncomeTax(51000) - germanIncomeTax(50000));
  });
});
describe("German pension and retirement", () => {
  it("never treats statutory entitlements as capital", () => {
    const p = pensionPlanSchema.parse({ id: "p", name: "GRV", kind: "statutory", capital: 100000, points: 40, annualPoints: 1, yearsUntilPayment: 5, accessFactor: .9 });
    const result = projectGermanPension(p); expect(result.currentCapital).toBe(0); expect(result.projectedCapital).toBe(0); expect(result.monthlyGross).toBeCloseTo(45 * 42.52 * .9);
  });
  it("tracks AVD as a separate pension contract without assuming subsidies or liquid capital", () => {
    const avd = pensionPlanSchema.parse({ id: "avd", name: "My AVD", kind: "avd", capital: 10000, monthlyContribution: 100, yearsUntilPayment: 10 });
    const result = projectGermanPension(avd);
    expect(result.projectedCapital).toBe(22000);
    expect(result.monthlyGross).toBe(0);
    expect(result.lumpSum).toBe(0);
    expect(germanPlanSchema.parse({ pensions: [avd] }).pensions[0].kind).toBe("avd");
  });
  it("projects zero-return monthly contributions and prevents double counting payout modes", () => {
    const p = pensionPlanSchema.parse({ id: "p", name: "Contract", kind: "private", capital: 10000, monthlyContribution: 100, yearsUntilPayment: 10, monthlyGross: 100 });
    expect(projectGermanPension(p).projectedCapital).toBe(22000); expect(projectGermanPension(p).lumpSum).toBe(0);
    expect(projectGermanPension({ ...p, paymentMode: "capital" }).monthlyGross).toBe(0);
  });
  it.each(["ruerup", "riester", "statutory", "avd"])("rejects full-capital payout for %s", kind => { expect(pensionPlanSchema.safeParse({ id: "p", name: "P", kind, paymentMode: "capital" }).success).toBe(false); });
  it("accounts for bridge years before pensions start", () => {
    const p = plan(); p.retirement = { ...p.retirement, liquidCapital: 30000, annualSpending: 12000, realReturn: 0, inflation: 0, pensionDeductionRate: 0 };
    p.pensions = [pensionPlanSchema.parse({ id: "p", name: "P", kind: "private", monthlyGross: 1000, yearsUntilPayment: 2 })];
    const result = germanRetirement(p); expect(result.rows[0].capital).toBe(18000); expect(result.rows[1].capital).toBe(6000); expect(result.rows[2].withdrawal).toBe(0); expect(result.depletedAfter).toBeNull();
  });
  it("adds a contract lump sum once, including payments before retirement", () => {
    const p = plan(); p.retirement = { ...p.retirement, yearsUntilRetirement: 3, realReturn: 0, inflation: 0, pensionDeductionRate: 0 };
    p.pensions = [pensionPlanSchema.parse({ id: "p", name: "P", kind: "private", capital: 10000, yearsUntilPayment: 1, paymentMode: "capital" })];
    const result = germanRetirement(p); expect(result.atRetirement).toBe(10000); expect(result.rows[49].capital).toBe(10000);
  });
  it("rejects unsupported versions, non-finite inputs and invalid dates", () => {
    expect(germanPlanSchema.safeParse({ version: 2 }).success).toBe(false);
    const pension = pensionPlanSchema.parse({ id: "same", name: "P", kind: "statutory" });
    expect(germanPlanSchema.safeParse({ pensions: [pension, pension] }).success).toBe(false);
    expect(germanPlanSchema.safeParse({ crypto: [{ id: "c", name: "C", acquired: "2025-01-01", sold: "2027-01-01", cost: 1, proceeds: 2 }] }).success).toBe(false);
    expect(germanPlanSchema.safeParse({ retirement: { realReturn: Infinity } }).success).toBe(false);
    expect(germanPlanSchema.safeParse({ crypto: [{ id: "c", name: "C", acquired: "2026-02-30", sold: "2026-02-01", cost: 1, proceeds: 2 }] }).success).toBe(false);
  });
});
describe("German income forecasting", () => {
  it("uses only validated tax years and never Italian net rates", () => {
    const d = data([tx({ date: "2025-01-01" })]); d.dividends = [{ instrumentId: "stock", exDate: "2025-12-01", amount: "200" }, { instrumentId: "stock", exDate: "2026-03-01", amount: "200" }];
    const view = germanIncomeForecast(d, plan().tax, "2026-10-14");
    expect(view.events.find(e => e.date === "2026-12-01")?.net).toBe(1736.25);
    expect(view.events.find(e => e.date === "2027-03-01")?.net).toBeNull();
  });
});
