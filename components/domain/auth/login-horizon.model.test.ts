import { describe, expect, it } from "vitest";
import { baseLevel, createHorizonSeries, HORIZON_POINTS, HORIZON_START_K, smoothPath } from "./login-horizon.model";

describe("login-horizon.model", () => {
  it("parte da una finestra che sale e chiude in alto", () => {
    expect(baseLevel(HORIZON_START_K + HORIZON_POINTS)).toBeGreaterThan(baseLevel(HORIZON_START_K));
    expect(baseLevel(HORIZON_START_K + HORIZON_POINTS)).toBeGreaterThan(0.6);
  });

  it("la finestra iniziale è deterministica, anche con un generatore casuale diverso", () => {
    const a = createHorizonSeries(() => 0.1);
    const b = createHorizonSeries(() => 0.9);
    for (let k = HORIZON_START_K; k <= HORIZON_START_K + HORIZON_POINTS; k++) expect(a.levelAt(k)).toBe(b.levelAt(k));
  });

  it("resta in scala su un orizzonte lungo, con generatori estremi e casuali", () => {
    for (const random of [() => 0, () => 0.999, Math.random]) {
      const series = createHorizonSeries(random);
      for (let k = HORIZON_START_K; k < HORIZON_START_K + 5000; k++) {
        const level = series.levelAt(k);
        expect(level).toBeGreaterThanOrEqual(0.1);
        expect(level).toBeLessThanOrEqual(1);
      }
    }
  });

  it("la curva passa per i punti interi", () => {
    const series = createHorizonSeries(() => 0.5);
    expect(series.curveAt(HORIZON_START_K + 3)).toBeCloseTo(series.levelAt(HORIZON_START_K + 3), 10);
  });

  it("costruisce un path che parte dal primo punto", () => {
    expect(smoothPath([{ x: 0, y: 5 }, { x: 10, y: 7 }])).toMatch(/^M0,5 C/);
    expect(smoothPath([])).toBe("");
  });
});
