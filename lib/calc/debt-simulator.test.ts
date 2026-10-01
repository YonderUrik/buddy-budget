import { describe, expect, it } from "vitest";
import { comparePayoffStrategies, compareRefinance, creditLineRateScenarios, simulatePayoff, type PayoffLoan } from "./debt-simulator";

const today = "2026-10-01";

describe("compareRefinance", () => {
  const current = { residual: 10000, currentInstallment: 450, interestRemaining: 1200, endDate: "2028-10-01" };
  it("calcola il risparmio netto e il pareggio", () => {
    const r = compareRefinance(current, today, { annualRate: 3, installments: 24, upfrontCosts: 100, penalty: 50 });
    expect(r.switchCosts).toBe(150);
    expect(r.newInterest).toBeCloseTo(r.newInstallment * 24 - 10000, 2);
    expect(r.netSaving).toBeCloseTo(1200 - r.newInterest - 150, 2);
    expect(r.newEndDate).toBe("2028-10-01");
    expect(r.breakEvenMonths).toBe(Math.ceil(150 / (450 - r.newInstallment)));
  });
  it("con un tasso peggiore non conviene e non c'è pareggio", () => {
    const r = compareRefinance(current, today, { annualRate: 12, installments: 24, upfrontCosts: 0, penalty: 0 });
    expect(r.netSaving).toBeLessThan(0);
    expect(r.breakEvenMonths).toBeNull();
  });
});

describe("creditLineRateScenarios", () => {
  it("scala il costo con i punti in più", () => {
    const rows = creditLineRateScenarios(10000, 4);
    expect(rows[0]).toMatchObject({ points: 0.5, rate: 4.5, yearlyCost: 450, extraYearly: 50 });
    expect(rows[2].monthlyCost).toBeCloseTo(50, 2);
  });
});

describe("simulatePayoff", () => {
  const loans: PayoffLoan[] = [
    { id: "a", name: "Piccolo", residual: 2000, annualRate: 5, installment: 200 },
    { id: "b", name: "Caro", residual: 8000, annualRate: 12, installment: 300 },
  ];
  it("senza extra paga le rate e basta", () => {
    const r = simulatePayoff(loans, 0, "none", today);
    expect(r.months).toBeGreaterThan(20);
    expect(r.closeOrder).toEqual(["Piccolo", "Caro"]);
  });
  it("con un extra finisce prima e paga meno interessi, in tutte e due le strategie", () => {
    const all = comparePayoffStrategies(loans, 200, today);
    expect(all.avalanche.months).toBeLessThan(all.none.months);
    expect(all.snowball.totalInterest).toBeLessThan(all.none.totalInterest);
  });
  it("la valanga non paga più interessi della palla di neve", () => {
    const all = comparePayoffStrategies(loans, 200, today);
    expect(all.avalanche.totalInterest).toBeLessThanOrEqual(all.snowball.totalInterest);
  });
  it("la palla di neve chiude prima il debito più piccolo", () => {
    expect(comparePayoffStrategies(loans, 300, today).snowball.closeOrder[0]).toBe("Piccolo");
  });
  it("ignora i debiti già chiusi", () => {
    expect(simulatePayoff([{ id: "x", name: "X", residual: 0, annualRate: 5, installment: 100 }], 0, "none", today).months).toBe(0);
  });
});
