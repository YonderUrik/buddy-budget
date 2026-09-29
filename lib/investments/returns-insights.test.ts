import { describe, expect, it } from "vitest";
import { benchmarkVerdict, timingInsight } from "./returns-insights";

describe("timingInsight", () => {
  it("spiega la differenza tra i due rendimenti solo quando è rilevante", () => {
    expect(timingInsight(0.2, 0.1)).toContain("meno");
    expect(timingInsight(0.1, 0.2)).toContain("più bassi");
    expect(timingInsight(0.1, 0.105)).toBeNull();
    expect(timingInsight(null, 0.1)).toBeNull();
  });
});

describe("benchmarkVerdict", () => {
  it("confronta i valori finali con una tolleranza dell'1%", () => {
    expect(benchmarkVerdict({ portfolioValue: 1100, simulatedValue: 1000 })).toBe("better");
    expect(benchmarkVerdict({ portfolioValue: 900, simulatedValue: 1000 })).toBe("worse");
    expect(benchmarkVerdict({ portfolioValue: 1005, simulatedValue: 1000 })).toBe("even");
  });
});
