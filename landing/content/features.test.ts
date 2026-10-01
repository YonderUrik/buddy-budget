import { describe, expect, it } from "vitest";
import { FEATURES, FEATURE_AREAS, featureCounts, featuresByArea } from "./features";

describe("FEATURES", () => {
  it("ha titoli unici e non vuoti", () => {
    const titles = FEATURES.map((f) => f.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.every((t) => t.trim().length > 0)).toBe(true);
  });

  it("assegna ogni funzione a un'area esistente e ogni area ha funzioni", () => {
    const ids = [...FEATURE_AREAS];
    expect(FEATURES.every((f) => ids.includes(f.area))).toBe(true);
    expect(ids.every((id) => featuresByArea(id).length > 0)).toBe(true);
  });

  it("i conteggi sono coerenti", () => {
    const c = featureCounts();
    expect(c.total).toBe(FEATURES.length);
    expect(c.available).toBeLessThanOrEqual(c.total);
  });
});
