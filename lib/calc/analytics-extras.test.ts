import { describe, expect, it } from "vitest";
import { costDrag, summarizeCosts } from "./costs";
import { splitGrowth } from "./growth-split";
import { computeLiquidation } from "./liquidation";
import { calmarRatio, concentration, historicalTailRisk, riskContributions, sortinoRatio } from "./risk-extras";

describe("splitGrowth", () => {
  it("separa risparmio e mercato per differenza", () => {
    const s = splitGrowth([
      { month: "2026-01", netWorth: 100, savings: 0 },
      { month: "2026-02", netWorth: 130, savings: 10 },
      { month: "2026-03", netWorth: 120, savings: 10 },
    ]);
    expect(s.totalDelta).toBe(20);
    expect(s.totalFromSavings).toBe(20);
    expect(s.totalFromMarket).toBe(0);
    expect(s.rows[1].fromMarket).toBe(-20);
    expect(s.savingsShare).toBe(1);
  });
  it("quota nulla se non si cresce", () => {
    expect(splitGrowth([{ month: "a", netWorth: 10, savings: 0 }, { month: "b", netWorth: 5, savings: 1 }]).savingsShare).toBeNull();
  });
});

describe("risk extras", () => {
  it("Sortino ignora i rialzi", () => {
    expect(sortinoRatio([0.01, 0.02, 0.03], 252, 0)).toBeNull();
    expect(sortinoRatio([0.02, -0.01, 0.03, -0.02], 252, 0)).not.toBeNull();
  });
  it("Calmar richiede un calo", () => {
    expect(calmarRatio(0.1, 0.2)).toBeCloseTo(0.5);
    expect(calmarRatio(0.1, 0)).toBeNull();
  });
  it("VaR e CVaR storici", () => {
    const r = Array.from({ length: 200 }, (_, i) => (i - 100) / 1000);
    const t = historicalTailRisk(r, 0.95)!;
    expect(t.var).toBeGreaterThan(0);
    expect(t.cvar).toBeGreaterThanOrEqual(t.var);
    expect(historicalTailRisk([0.1], 0.95)).toBeNull();
  });
  it("contributi di rischio sommano a 1 e premiano la posizione più volatile", () => {
    const calm = Array.from({ length: 100 }, (_, i) => Math.sin(i) * 0.005);
    const wild = Array.from({ length: 100 }, (_, i) => Math.cos(i * 1.7) * 0.03);
    const c = riskContributions([{ id: "a", weight: 0.5, returns: calm }, { id: "b", weight: 0.5, returns: wild }])!;
    expect(c[0].riskShare + c[1].riskShare).toBeCloseTo(1, 10);
    expect(c[1].riskShare).toBeGreaterThan(0.8);
  });
  it("concentrazione", () => {
    expect(concentration([1, 1, 1, 1])!.effectiveN).toBeCloseTo(4);
    expect(concentration([1])!.hhi).toBe(1);
    expect(concentration([])).toBeNull();
  });
});

describe("costi e liquidazione", () => {
  it("somma TER e bollo", () => {
    const s = summarizeCosts([
      { id: "a", name: "A", value: 10_000, ter: 0.002, subjectToBollo: true },
      { id: "b", name: "B", value: 10_000, ter: null, subjectToBollo: false },
    ]);
    expect(s.annualCost).toBeCloseTo(20 + 20);
    expect(s.missingTerValue).toBe(10_000);
    expect(s.annualPct).toBeCloseTo(40 / 20_000);
  });
  it("l'erosione cresce nel tempo", () => {
    const d = costDrag(10_000, 0.05, 0.01, 30);
    expect(d[0].lost).toBe(0);
    expect(d[30].lost).toBeGreaterThan(d[10].lost);
  });
  it("imposta latente solo sui guadagni", () => {
    const r = computeLiquidation([
      { id: "a", name: "A", value: 1000, unrealizedGain: 500, taxRate: 0.26 },
      { id: "b", name: "B", value: 500, unrealizedGain: -100, taxRate: 0.26 },
      { id: "c", name: "C", value: 1000, unrealizedGain: 200, taxRate: 0.125 },
    ]);
    expect(r.latentTax).toBeCloseTo(130 + 25);
    expect(r.netValue).toBeCloseTo(2500 - 155);
    expect(r.byPosition[0].id).toBe("a");
  });
});

describe("annualizedReturn", () => {
  it("compone i rendimenti giornalieri", async () => {
    const { annualizedReturn } = await import("./risk-extras");
    expect(annualizedReturn(Array(252).fill(0.0001), 252)!).toBeCloseTo(1.0001 ** 252 - 1, 8);
    expect(annualizedReturn([], 252)).toBeNull();
  });
});
