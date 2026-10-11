import { describe, expect, it } from "vitest";
import { RISK_LEVEL_HIGH, RISK_LEVEL_LOW, RISK_LEVEL_MEDIUM, RISK_SCALE_MAX, riskLevel, riskLevelInsight, riskScalePosition } from "./risk-insights";

describe("riskLevel", () => {
  it("assegna il livello in base alle soglie di oscillazione", () => {
    expect(riskLevel(0.02)).toBe(1);
    expect(riskLevel(RISK_LEVEL_LOW)).toBe(2);
    expect(riskLevel(RISK_LEVEL_MEDIUM - 0.001)).toBe(2);
    expect(riskLevel(RISK_LEVEL_MEDIUM)).toBe(3);
    expect(riskLevel(RISK_LEVEL_HIGH)).toBe(4);
  });
  it("ha una frase per ogni livello", () => {
    for (const level of [1, 2, 3, 4] as const) expect(riskLevelInsight(level).length).toBeGreaterThan(10);
  });
});

describe("riskScalePosition", () => {
  it("parte da 0, passa dai confini delle fasce e si ferma a 1", () => {
    expect(riskScalePosition(0)).toBe(0);
    expect(riskScalePosition(RISK_LEVEL_LOW)).toBeCloseTo(0.25);
    expect(riskScalePosition(RISK_LEVEL_MEDIUM)).toBeCloseTo(0.5);
    expect(riskScalePosition(RISK_LEVEL_HIGH)).toBeCloseTo(0.75);
    expect(riskScalePosition(RISK_SCALE_MAX)).toBe(1);
    expect(riskScalePosition(0.9)).toBe(1);
  });
  it("sta dentro la fascia del livello", () => {
    const position = riskScalePosition(0.037);
    expect(position).toBeGreaterThan(0);
    expect(position).toBeLessThan(0.25);
  });
});
