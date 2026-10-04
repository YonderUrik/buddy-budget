import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS } from "@/lib/analitiche/assumptions";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import type { MonteCarloResult } from "@/lib/calc/monte-carlo";
import { costsSentences, journeySentences, lastingAnswer, successVerdict, timelineHeadline, timelineScenarios, timelineSeries, yearsWithChanges } from "./plain-answers";

const PLAN = {
  spending: 30000,
  savings: 12000,
  wealth: 200000,
  liquidation: { latentTax: 465, grossValue: 200000, netValue: 199535, taxRatio: 0.002, byPosition: [] },
  taxShare: 0,
  fireNumberGross: 857143,
  target: 857143,
  progress: 0.23,
  yearsToFire: 20,
  coast: [],
} as unknown as AnalyticsPlan;

const mc = (rule: MonteCarloResult["rule"], successRate: number) => ({ rule, successRate }) as MonteCarloResult;

describe("plain-answers", () => {
  it("giudica la probabilità di successo a tre livelli", () => {
    expect(successVerdict(0.95).tone).toBe("pos");
    expect(successVerdict(0.8).tone).toBe("default");
    expect(successVerdict(0.3).tone).toBe("neg");
  });

  it("la domanda 1 usa i numeri dell'utente e la quota di crescita dal risparmio", () => {
    const split = { rows: [{}, {}], totalDelta: 40000, savingsShare: 0.13 } as never;
    const text = journeySentences(PLAN, split, "EUR").join(" ");
    expect(text).toContain("857.143");
    expect(text).toContain("13%");
  });

  it("spendere meno o risparmiare di più anticipa il traguardo", () => {
    const base = yearsWithChanges(PLAN, DEFAULT_ASSUMPTIONS, {})!;
    const plan = { ...PLAN, yearsToFire: base } as AnalyticsPlan;
    expect(yearsWithChanges(PLAN, DEFAULT_ASSUMPTIONS, { spending: -0.1 })!).toBeLessThan(base);
    expect(yearsWithChanges(PLAN, DEFAULT_ASSUMPTIONS, { saving: 1200 })!).toBeLessThan(base);
    expect(timelineScenarios(plan, DEFAULT_ASSUMPTIONS, "EUR").every((s) => (s.yearsSaved ?? 0) > 0)).toBe(true);
  });

  it("il titolo della domanda 2 copre traguardo vicino, raggiunto e irraggiungibile", () => {
    const today = new Date(2026, 5, 1);
    expect(timelineHeadline(PLAN, today)).toContain("2046");
    expect(timelineHeadline({ ...PLAN, yearsToFire: 0 } as AnalyticsPlan, today)).toContain("già raggiunto");
    expect(timelineHeadline({ ...PLAN, yearsToFire: null } as AnalyticsPlan, today)).toContain("oltre 80");
    expect(timelineHeadline({ ...PLAN, target: null } as AnalyticsPlan, today)).toContain("spesa annua");
  });

  it("la serie parte dal patrimonio di oggi e supera il numero FIRE oltre il traguardo", () => {
    const series = timelineSeries(PLAN, DEFAULT_ASSUMPTIONS);
    expect(series[0].wealth).toBe(200000);
    expect(series.at(-1)!.wealth).toBeGreaterThan(857143);
  });

  it("la domanda 3 segnala la regola migliore solo se batte quella scelta", () => {
    const results = [mc("fissa", 0.2), mc("percentuale", 1), mc("guyton-klinger", 0.2), mc("vanguard", 0.2)];
    const a = lastingAnswer(results, "fissa", 40)!;
    expect(a.headline).toContain("20%");
    expect(a.better?.label).toBe("percentuale del patrimonio");
    expect(lastingAnswer(results, "percentuale", 40)!.better).toBeNull();
    expect(lastingAnswer([], "fissa", 40)).toBeNull();
  });

  it("la domanda 4 parla di costi, erosione e imposte, senza inventare se non ci sono investimenti", () => {
    const summary = { rows: [], totalValue: 35000, annualCost: 71, annualPct: 0.002, missingTerValue: 0 };
    const text = costsSentences(summary, 16441, 30, PLAN.liquidation, "EUR").join(" ");
    expect(text).toContain("71");
    expect(text).toContain("16.441");
    expect(text).toContain("465");
    expect(costsSentences({ ...summary, totalValue: 0 }, null, 30, PLAN.liquidation, "EUR")).toHaveLength(1);
  });
});
