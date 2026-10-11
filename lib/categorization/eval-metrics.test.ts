import { describe, expect, it } from "vitest";
import { summarizeByThreshold, topConfusions, type EvalPrediction } from "./eval-metrics";

const predictions: EvalPrediction[] = [
  { expected: "Spesa", predicted: "Spesa", confidence: 0.99, weight: 10 },
  { expected: "Spesa", predicted: "Ristoranti", confidence: 0.6, weight: 4 },
  { expected: "Affitto", predicted: null, confidence: 0, weight: 6 },
];

describe("summarizeByThreshold", () => {
  it("pesa copertura e precisione sui movimenti", () => {
    const [all, high] = summarizeByThreshold(predictions, [0, 0.9]);
    expect(all.coverage).toBeCloseTo(14 / 20);
    expect(all.precision).toBeCloseTo(10 / 14);
    expect(high.coverage).toBeCloseTo(10 / 20);
    expect(high.precision).toBe(1);
  });

  it("non divide per zero senza proposte", () => {
    expect(summarizeByThreshold([], [0.9])).toEqual([{ threshold: 0.9, coverage: 0, precision: 0 }]);
  });
});

describe("topConfusions", () => {
  it("elenca gli errori più pesanti", () => {
    expect(topConfusions(predictions)).toEqual([["Spesa -> Ristoranti", 4]]);
  });
});
