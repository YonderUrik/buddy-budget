import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/layout/sidebar";
import { FEATURES, FEATURE_AREAS, FEATURE_AREA_LABELS_EN, featureCounts, featuresByArea, featuresByStatus } from "./catalog";

describe("catalogo funzionalità", () => {
  it("ha id unici", () => {
    const ids = FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ha nomi unici e ogni area ha almeno una funzione", () => {
    const names = FEATURES.map((feature) => feature.name);
    expect(new Set(names).size).toBe(names.length);
    for (const area of FEATURE_AREAS) expect(featuresByArea(area).length).toBeGreaterThan(0);
  });

  it("i conteggi sono coerenti", () => {
    const { total, available } = featureCounts();
    expect(total).toBe(FEATURES.length);
    expect(available).toBe(FEATURES.length - featuresByStatus("soon").length);
  });

  it("every entry has an English name and description, unique by name", () => {
    for (const feature of FEATURES) {
      expect(feature.en?.name, `${feature.id} has no English name`).toBeTruthy();
      expect(feature.en?.description, `${feature.id} has no English description`).toBeTruthy();
    }
    const names = FEATURES.map((feature) => feature.en?.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every area has an English label", () => {
    for (const area of FEATURE_AREAS) expect(FEATURE_AREA_LABELS_EN[area]).toBeTruthy();
  });

  it("ogni voce di sidebar ha la sua scheda, con lo stesso stato", () => {
    for (const item of NAV_ITEMS) {
      const feature = FEATURES.find((candidate) => candidate.appPath === item.href);
      expect(feature, `manca la scheda del catalogo per ${item.href}`).toBeDefined();
      if (item.comingSoon) expect(feature?.status).toBe("soon");
      else expect(["live", "new"]).toContain(feature?.status);
    }
  });
});
