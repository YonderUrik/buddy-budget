import { describe, expect, it } from "vitest";
import { RISK_LEVEL_HIGH, RISK_LEVEL_LOW, RISK_LEVEL_MEDIUM, riskLevel, riskLevelInsight } from "./risk-insights";

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
