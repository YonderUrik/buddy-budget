import { describe, expect, it } from "vitest";
import { buildFrenchPlan, frenchInstallment, simulateEarlyRepayment } from "./ammortamento";

describe("piano alla francese", () => {
  it("rata nota: 100.000 € al 3% su 20 anni ≈ 554,60 €", () => {
    expect(frenchInstallment(100000, 3, 240)).toBeCloseTo(554.6, 1);
  });
  it("chiude a zero e il capitale rimborsato è il finanziamento", () => {
    const p = buildFrenchPlan(100000, 3, 240);
    expect(p.rows.at(-1)?.balance).toBeCloseTo(0, 6);
    expect(p.rows.reduce((s, r) => s + r.principal, 0)).toBeCloseTo(100000, 4);
  });
  it("tasso zero", () => {
    expect(frenchInstallment(1200, 0, 12)).toBe(100);
  });
});

describe("estinzione parziale", () => {
  it("risparmia interessi e la penale li riduce", () => {
    const r = simulateEarlyRepayment({ principal: 100000, annualRatePct: 3, months: 240, afterMonths: 60, extra: 20000, penaltyPct: 1 });
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.penalty).toBe(200);
    expect(r.netSaving).toBeCloseTo(r.interestSaved - 200);
    expect(r.monthsLeftSameInstallment).toBeLessThan(180);
    expect(r.newInstallmentSameTerm).toBeLessThan(554.6);
  });
});
