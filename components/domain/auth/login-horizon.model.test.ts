import { describe, expect, it } from "vitest";
import { HORIZON_POINTS, HORIZON_START_K, horizonLevel, horizonValue, smoothPath } from "./login-horizon.model";

describe("login-horizon.model", () => {
  it("tiene la serie dentro [0, 1] su un orizzonte lungo", () => {
    for (let k = 0; k < 5000; k++) {
      const level = horizonLevel(k);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });

  it("parte da una finestra che sale e chiude in alto", () => {
    expect(horizonValue(HORIZON_START_K + HORIZON_POINTS)).toBeGreaterThan(horizonValue(HORIZON_START_K));
    expect(horizonLevel(HORIZON_START_K + HORIZON_POINTS)).toBeGreaterThan(0.6);
  });

  it("costruisce un path che parte dal primo punto", () => {
    expect(smoothPath([{ x: 0, y: 5 }, { x: 10, y: 7 }])).toMatch(/^M0,5 C/);
    expect(smoothPath([])).toBe("");
  });
});
