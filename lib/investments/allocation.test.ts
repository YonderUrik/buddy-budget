import { describe, expect, it } from "vitest";
import { analyzeAllocation, isCompleteTarget, roundedCurrentWeights, suggestContribution } from "./allocation";

describe("analyzeAllocation", () => {
  it("confronta i pesi attuali con l'obiettivo, anche per strumenti non posseduti o fuori obiettivo", () => {
    const analysis = analyzeAllocation(
      [
        { instrumentId: "a", value: 800 },
        { instrumentId: "b", value: 200 },
        { instrumentId: "x", value: null },
      ],
      [
        { instrumentId: "a", weight: 0.6 },
        { instrumentId: "c", weight: 0.4 },
      ]
    );
    expect(analysis.total).toBe(1000);
    expect(analysis.unpricedIds).toEqual(["x"]);
    const byId = Object.fromEntries(analysis.rows.map((r) => [r.instrumentId, r]));
    expect(byId.a).toMatchObject({ currentWeight: 0.8, targetWeight: 0.6, status: "sopra", inTarget: true });
    expect(byId.b).toMatchObject({ targetWeight: 0, status: "sopra", inTarget: false });
    expect(byId.c).toMatchObject({ value: 0, currentWeight: 0, status: "sotto" });
    expect(analysis.rows[0].instrumentId).toBe("c");
    expect(analysis.maxDrift).toBeCloseTo(0.4);
  });

  it("entro ±5 punti è in linea", () => {
    const analysis = analyzeAllocation([{ instrumentId: "a", value: 52 }, { instrumentId: "b", value: 48 }], [
      { instrumentId: "a", weight: 0.5 },
      { instrumentId: "b", weight: 0.5 },
    ]);
    expect(analysis.rows.every((r) => r.status === "in_linea")).toBe(true);
  });
});

describe("suggestContribution", () => {
  const targets = [
    { instrumentId: "a", weight: 0.7 },
    { instrumentId: "b", weight: 0.2 },
    { instrumentId: "c", weight: 0.1 },
  ];

  it("se il versamento basta a colmare tutti gli scostamenti, il portafoglio finisce esattamente sull'obiettivo", () => {
    const analysis = analyzeAllocation([{ instrumentId: "a", value: 700 }, { instrumentId: "b", value: 100 }], targets);
    const buys = suggestContribution(analysis, 200);
    const byId = Object.fromEntries(buys.map((b) => [b.instrumentId, b]));
    expect(byId.b.amount).toBeCloseTo(100);
    expect(byId.c.amount).toBeCloseTo(100);
    expect(byId.a).toBeUndefined();
    for (const b of buys) expect(b.weightAfter).toBeCloseTo(b.targetWeight);
    expect(buys.reduce((s, b) => s + b.amount, 0)).toBeCloseTo(200);
  });

  it("con un versamento piccolo compra prima il più sotto obiettivo in proporzione al peso", () => {
    const analysis = analyzeAllocation([{ instrumentId: "a", value: 700 }, { instrumentId: "b", value: 100 }], targets);
    const buys = suggestContribution(analysis, 50);
    // c è a 0 su 10%: il più sotto obiettivo. Con 50 € non si arriva al livello di b.
    expect(buys).toHaveLength(1);
    expect(buys[0]).toMatchObject({ instrumentId: "c" });
    expect(buys[0].amount).toBeCloseTo(50);
  });

  it("scarta gli acquisti sotto il 10% del versamento e ridistribuisce", () => {
    const analysis = analyzeAllocation(
      [
        { instrumentId: "a", value: 690 },
        { instrumentId: "b", value: 205 },
        { instrumentId: "c", value: 100 },
      ],
      targets
    );
    const buys = suggestContribution(analysis, 100);
    expect(buys.every((b) => b.amount >= 10)).toBe(true);
    expect(buys.reduce((s, b) => s + b.amount, 0)).toBeCloseTo(100);
  });

  it("niente suggerimenti senza importo", () => {
    expect(suggestContribution(analyzeAllocation([], targets), 0)).toEqual([]);
  });
});

describe("pesi", () => {
  it("i pesi attuali arrotondati sommano esattamente a 100", () => {
    const weights = roundedCurrentWeights([
      { instrumentId: "a", value: 333 },
      { instrumentId: "b", value: 333 },
      { instrumentId: "c", value: 334 },
      { instrumentId: "d", value: null },
    ]);
    expect(weights.reduce((s, w) => s + Math.round(w.weight * 100), 0)).toBe(100);
    expect(isCompleteTarget(weights)).toBe(true);
    expect(isCompleteTarget([{ instrumentId: "a", weight: 0.5 }])).toBe(false);
  });
});
