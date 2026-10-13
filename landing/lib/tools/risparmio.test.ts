import { describe, expect, it } from "vitest";
import { MAX_GOAL_MONTHS, monthlyNeeded, savingsGoal } from "./risparmio";

describe("savingsGoal", () => {
  it("senza rendimento è una divisione: 20.000 € a 500 € al mese partendo da 2.000 € sono 36 mesi", () => {
    const r = savingsGoal({ target: 20000, start: 2000, monthly: 500, annualReturnPct: 0 });
    expect(r.months).toBe(36);
    expect(r.contributed).toBe(20000);
    expect(r.growth).toBeCloseTo(0);
  });

  it("con un rendimento ci si arriva prima e una parte viene dagli interessi", () => {
    const r = savingsGoal({ target: 20000, start: 2000, monthly: 500, annualReturnPct: 3 });
    expect(r.months).toBeLessThan(36);
    expect(r.growth).toBeGreaterThan(0);
  });

  it("se hai già la cifra sono zero mesi", () => {
    expect(savingsGoal({ target: 1000, start: 1500, monthly: 0, annualReturnPct: 0 }).months).toBe(0);
  });

  it("senza versamenti né rendimento non ci si arriva", () => {
    const r = savingsGoal({ target: 1000, start: 0, monthly: 0, annualReturnPct: 0 });
    expect(r.months).toBeNull();
    expect(r.path).toHaveLength(MAX_GOAL_MONTHS + 1);
  });
});

describe("monthlyNeeded", () => {
  it("è l'inverso di savingsGoal", () => {
    const need = monthlyNeeded(20000, 2000, 24, 3);
    expect(savingsGoal({ target: 20000, start: 2000, monthly: need + 0.01, annualReturnPct: 3 }).months).toBe(24);
  });

  it("senza rendimento è la differenza divisa per i mesi", () => {
    expect(monthlyNeeded(12000, 0, 12, 0)).toBeCloseTo(1000);
  });
});
