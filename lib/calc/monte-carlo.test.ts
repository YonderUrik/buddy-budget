import { describe, expect, it } from "vitest";
import { compareRules, lognormalParams, mulberry32, percentile, runMonteCarlo, type MonteCarloInput } from "./monte-carlo";

const BASE: MonteCarloInput = {
  startingWealth: 1_000_000,
  annualSavings: 0,
  accumulationYears: 0,
  retirementYears: 30,
  annualSpending: 40_000,
  expectedReturn: 0.04,
  volatility: 0.12,
  rule: "fissa",
  paths: 800,
  seed: 7,
};

describe("generatore e utilità", () => {
  it("è deterministico per seed", () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("percentile interpola", () => {
    expect(percentile([0, 10], 50)).toBe(5);
    expect(percentile([], 50)).toBe(0);
  });
  it("lognormale conserva la media aritmetica", () => {
    const { mu, sd } = lognormalParams(0.05, 0.2);
    expect(Math.exp(mu + (sd * sd) / 2)).toBeCloseTo(1.05, 10);
  });
});

describe("runMonteCarlo", () => {
  it("senza volatilità la fissa è deterministica", () => {
    const r = runMonteCarlo({ ...BASE, volatility: 0, paths: 10 });
    expect(r.successRate).toBe(1);
    expect(r.wealth[1].p50).toBeCloseTo((1_000_000 - 40_000) * 1.04, 4);
    expect(r.wealth[1].p10).toBeCloseTo(r.wealth[1].p90, 6);
  });
  it("spesa troppo alta senza rendimento esaurisce il patrimonio", () => {
    const r = runMonteCarlo({ ...BASE, volatility: 0, expectedReturn: 0, annualSpending: 100_000, paths: 5 });
    expect(r.successRate).toBe(0);
    expect(r.ruinByYear[r.ruinByYear.length - 1]).toBe(1);
  });
  it("è riproducibile e più volatilità peggiora il successo", () => {
    expect(runMonteCarlo(BASE)).toEqual(runMonteCarlo(BASE));
    const calm = runMonteCarlo({ ...BASE, annualSpending: 55_000, volatility: 0.05 });
    const wild = runMonteCarlo({ ...BASE, annualSpending: 55_000, volatility: 0.25 });
    expect(wild.successRate).toBeLessThan(calm.successRate);
  });
  it("la curva di rovina è non decrescente e coerente col successo", () => {
    const r = runMonteCarlo({ ...BASE, annualSpending: 60_000 });
    for (let i = 1; i < r.ruinByYear.length; i++) expect(r.ruinByYear[i]).toBeGreaterThanOrEqual(r.ruinByYear[i - 1]);
    expect(1 - r.ruinByYear[r.ruinByYear.length - 1]).toBeCloseTo(r.successRate, 10);
  });
  it("l'accumulo fa crescere il patrimonio prima del prelievo", () => {
    const r = runMonteCarlo({ ...BASE, startingWealth: 100_000, annualSavings: 20_000, accumulationYears: 20, volatility: 0, paths: 3 });
    expect(r.wealth).toHaveLength(51);
    expect(r.wealth[20].p50).toBeGreaterThan(r.wealth[0].p50 + 20 * 20_000);
  });
  it("la pensione pubblica riduce il prelievo e migliora il successo", () => {
    const without = runMonteCarlo({ ...BASE, annualSpending: 55_000 });
    const withPension = runMonteCarlo({ ...BASE, annualSpending: 55_000, publicPension: { annual: 15_000, startsAfterYears: 10 } });
    expect(withPension.successRate).toBeGreaterThanOrEqual(without.successRate);
    expect(withPension.spending[15].p50).toBeGreaterThan(0);
  });
});

describe("regole di prelievo", () => {
  it("le regole adattive non fanno peggio della fissa su spesa alta", () => {
    const input = { ...BASE, annualSpending: 55_000, volatility: 0.15 };
    const [fissa, percentuale, gk, vanguard] = compareRules(input);
    expect(percentuale.successRate).toBeGreaterThanOrEqual(fissa.successRate);
    expect(gk.successRate).toBeGreaterThanOrEqual(fissa.successRate);
    expect(vanguard.successRate).toBeGreaterThanOrEqual(fissa.successRate - 0.02);
  });
  it("la fissa non taglia mai la spesa, la percentuale sì", () => {
    const [fissa, percentuale] = compareRules({ ...BASE, annualSpending: 35_000, volatility: 0.15 });
    expect(fissa.maxCut.median).toBeCloseTo(0, 6);
    expect(percentuale.maxCut.median).toBeGreaterThan(fissa.maxCut.median);
  });
  it("Vanguard limita la variazione annua del prelievo mediano", () => {
    const r = runMonteCarlo({ ...BASE, rule: "vanguard" });
    expect(r.spending[0].p50).toBeCloseTo(40_000, 4);
    expect(r.spending[1].p50).toBeLessThanOrEqual(40_000 * 1.05 + 1);
    expect(r.spending[1].p50).toBeGreaterThanOrEqual(40_000 * 0.975 - 1);
  });
});
