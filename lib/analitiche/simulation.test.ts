import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import type { AnalyticsPlan } from "./plan";
import { buildSimulationInput } from "./simulation";

const PLAN = { spending: 30_000, wealth: 400_000, savings: 15_000, yearsToFire: 8.2 } as AnalyticsPlan;

describe("buildSimulationInput", () => {
  it("smettere oggi non ha accumulo", () => {
    expect(buildSimulationInput(PLAN, DEFAULT_ASSUMPTIONS, "oggi")!.accumulationYears).toBe(0);
  });
  it("smettere al FIRE accumula gli anni mancanti, arrotondati per eccesso", () => {
    expect(buildSimulationInput(PLAN, DEFAULT_ASSUMPTIONS, "fire")!.accumulationYears).toBe(9);
  });
  it("senza spesa non c'è nulla da simulare", () => {
    expect(buildSimulationInput({ ...PLAN, spending: null }, DEFAULT_ASSUMPTIONS, "oggi")).toBeNull();
  });
  it("un risparmio negativo non entra come versamento", () => {
    expect(buildSimulationInput({ ...PLAN, savings: -5000 }, DEFAULT_ASSUMPTIONS, "fire")!.annualSavings).toBe(0);
  });
});
