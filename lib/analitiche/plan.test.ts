import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import type { AnalyticsBase } from "./base";
import { resolvePlan } from "./plan";

const BASE: AnalyticsBase = {
  currency: "EUR",
  wealth: { liquidity: 50_000, investments: 250_000, pension: 40_000, debts: 0 },
  cashflow: { months: [], annualIncome: 50_000, annualSpending: 30_000, annualSavings: 20_000, savingsRate: 0.4, leanSpending: 20_000, monthsWithData: 12 },
  positions: [{ id: "a", name: "A", value: 250_000, ter: null, subjectToBollo: true, unrealizedGain: 100_000, taxRate: 0.26 }],
  growthPoints: [],
  risk: null,
  riskContribution: null,
  names: {},
};

describe("resolvePlan", () => {
  it("ricava spesa e risparmio dai dati e calcola il numero FIRE al netto delle imposte latenti", () => {
    const p = resolvePlan(BASE, DEFAULT_ASSUMPTIONS);
    expect(p.spendingSource).toBe("dati");
    expect(p.wealth).toBe(300_000);
    expect(p.liquidation.latentTax).toBeCloseTo(26_000);
    expect(p.fireNumberGross).toBeCloseTo(30_000 / 0.035);
    expect(p.target!).toBeGreaterThan(p.fireNumberGross!);
    expect(p.progress!).toBeGreaterThan(0);
    expect(p.yearsToFire!).toBeGreaterThan(0);
  });
  it("le ipotesi dell'utente prevalgono sui dati", () => {
    const p = resolvePlan(BASE, { ...DEFAULT_ASSUMPTIONS, annualSpending: 24_000, includeLatentTax: false });
    expect(p.spendingSource).toBe("ipotesi");
    expect(p.target).toBeCloseTo(24_000 / 0.035);
  });
  it("con pochi mesi di dati non inventa la spesa", () => {
    const p = resolvePlan({ ...BASE, cashflow: { ...BASE.cashflow, monthsWithData: 1 } }, DEFAULT_ASSUMPTIONS);
    expect(p.spending).toBeNull();
    expect(p.target).toBeNull();
    expect(p.spendingSource).toBe("manca");
  });
  it("la previdenza conta solo se scelto", () => {
    expect(resolvePlan(BASE, { ...DEFAULT_ASSUMPTIONS, includePensionFunds: true }).wealth).toBe(340_000);
  });
});
