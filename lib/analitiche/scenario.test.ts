import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import type { AnalyticsPlan } from "./plan";
import { applyScenario, hasScenario, scenarioSlider, yearsToFireWith } from "./scenario";

const PLAN = { spending: 18_000, savings: 12_000, wealth: 100_000, taxShare: 0 } as AnalyticsPlan;

describe("scenarioSlider", () => {
  it("non offre i cursori in euro se la cifra di partenza manca", () => {
    expect(scenarioSlider("annualSpending", null)).toBeNull();
    expect(scenarioSlider("annualSavings", null)).toBeNull();
  });
  it("copre almeno il doppio del valore di partenza e include sempre il valore stesso", () => {
    const s = scenarioSlider("annualSpending", 18_000)!;
    expect(s.min).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(36_000);
    const big = scenarioSlider("annualSavings", 50_000)!;
    expect(big.max).toBeGreaterThanOrEqual(100_000);
  });
  it("lascia scendere sotto zero un risparmio negativo", () => {
    expect(scenarioSlider("annualSavings", -3_000)!.min).toBeLessThanOrEqual(-6_000);
  });
  it("tiene i percentuali in un intervallo sensato", () => {
    expect(scenarioSlider("withdrawalRate", null)).toMatchObject({ min: 0.02, max: 0.06 });
    expect(scenarioSlider("expectedReturn", null)).toMatchObject({ min: 0, max: 0.08 });
  });
});

describe("applyScenario e hasScenario", () => {
  it("sovrascrive solo i campi mossi", () => {
    const next = applyScenario(DEFAULT_ASSUMPTIONS, { expectedReturn: 0.05 });
    expect(next.expectedReturn).toBe(0.05);
    expect(next.withdrawalRate).toBe(DEFAULT_ASSUMPTIONS.withdrawalRate);
    expect(hasScenario({})).toBe(false);
    expect(hasScenario({ annualSavings: 0 })).toBe(true);
  });
});

describe("yearsToFireWith", () => {
  const base = yearsToFireWith(PLAN, DEFAULT_ASSUMPTIONS, {});
  it("risparmiare di più o spendere meno accorcia i tempi", () => {
    expect(base).not.toBeNull();
    expect(yearsToFireWith(PLAN, DEFAULT_ASSUMPTIONS, { annualSavings: 18_000 })!).toBeLessThan(base!);
    expect(yearsToFireWith(PLAN, DEFAULT_ASSUMPTIONS, { annualSpending: 15_000 })!).toBeLessThan(base!);
  });
  it("un tasso di prelievo più alto abbassa il numero FIRE", () => {
    expect(yearsToFireWith(PLAN, DEFAULT_ASSUMPTIONS, { withdrawalRate: 0.04 })!).toBeLessThan(base!);
  });
  it("senza spesa non c'è risposta", () => {
    expect(yearsToFireWith({ ...PLAN, spending: null }, DEFAULT_ASSUMPTIONS, {})).toBeNull();
  });
});
