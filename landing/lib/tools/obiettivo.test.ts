import { describe, expect, it } from "vitest";
import { MAX_MONTHS, monthlyForTarget, monthsToTarget, planTarget, valueAfter } from "./obiettivo";

describe("mesi per arrivare all'obiettivo", () => {
  it("senza rendimento è una divisione, arrotondata al mese successivo", () => {
    expect(monthsToTarget({ target: 20000, start: 2000, monthly: 300, annualRatePct: 0 })).toBe(60);
    expect(monthsToTarget({ target: 20000, start: 2000, monthly: 350, annualRatePct: 0 })).toBe(52);
  });
  it("con il rendimento ci vuole meno", () => {
    const flat = monthsToTarget({ target: 20000, start: 2000, monthly: 300, annualRatePct: 0 });
    const withReturn = monthsToTarget({ target: 20000, start: 2000, monthly: 300, annualRatePct: 3 });
    expect(withReturn).toBeLessThan(flat);
    expect(valueAfter({ start: 2000, monthly: 300, annualRatePct: 3 }, withReturn)).toBeGreaterThanOrEqual(20000);
    expect(valueAfter({ start: 2000, monthly: 300, annualRatePct: 3 }, withReturn - 1)).toBeLessThan(20000);
  });
  it("zero se c'è già abbastanza, infinito se non ci si arriva", () => {
    expect(monthsToTarget({ target: 1000, start: 1500, monthly: 0, annualRatePct: 0 })).toBe(0);
    expect(monthsToTarget({ target: 1000, start: 0, monthly: 0, annualRatePct: 0 })).toBe(Infinity);
    expect(monthsToTarget({ target: 1000, start: 0, monthly: 0, annualRatePct: 5 })).toBe(Infinity);
    expect(monthsToTarget({ target: 10_000_000, start: 0, monthly: 1, annualRatePct: 0 })).toBe(Infinity);
    expect(MAX_MONTHS).toBe(1200);
  });
  it("mesi interi anche quando il conto cade esatto", () => {
    expect(monthsToTarget({ target: 1200, start: 0, monthly: 100, annualRatePct: 0 })).toBe(12);
  });
});

describe("versamento mensile per una scadenza", () => {
  it("senza rendimento è la differenza divisa per i mesi", () => {
    expect(monthlyForTarget({ target: 20000, start: 2000, annualRatePct: 0 }, 36)).toBe(500);
  });
  it("con il rendimento serve meno, e il risultato torna con il montante", () => {
    const monthly = monthlyForTarget({ target: 20000, start: 2000, annualRatePct: 3 }, 36);
    expect(monthly).toBeLessThan(500);
    expect(valueAfter({ start: 2000, monthly, annualRatePct: 3 }, 36)).toBeCloseTo(20000, 6);
  });
  it("zero se c'è già abbastanza", () => {
    expect(monthlyForTarget({ target: 1000, start: 5000, annualRatePct: 2 }, 12)).toBe(0);
  });
});

describe("piano", () => {
  it("separa quello che c'era, i versamenti e il rendimento", () => {
    const plan = planTarget({ target: 20000, start: 2000, monthly: 300, annualRatePct: 3 });
    expect(plan.finalValue).toBeGreaterThanOrEqual(20000);
    expect(plan.contributed).toBe(300 * plan.months);
    expect(plan.growth).toBeCloseTo(plan.finalValue - 2000 - plan.contributed, 6);
  });
  it("quando non si arriva non inventa numeri", () => {
    expect(planTarget({ target: 1000, start: 0, monthly: 0, annualRatePct: 0 })).toEqual({ months: Infinity, contributed: 0, growth: 0, finalValue: 0 });
  });
});
