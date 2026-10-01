import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/layout/sidebar";
import { UPCOMING_FEATURES } from "@/components/domain/auth/upcoming-features.data";
import { FEATURES, FEATURE_AREAS, featureCounts, featuresByArea, featuresByStatus } from "./catalog";

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

  it("ogni voce di sidebar ha la sua scheda, con lo stesso stato", () => {
    for (const item of NAV_ITEMS) {
      const feature = FEATURES.find((candidate) => candidate.appPath === item.href);
      expect(feature, `manca la scheda del catalogo per ${item.href}`).toBeDefined();
      expect(feature?.status).toBe(item.comingSoon ? "soon" : "live");
    }
  });

  it("il pannello \"In arrivo\" del login mostra esattamente le funzionalità `soon`", () => {
    const screens = featuresByStatus("soon").filter((feature) => feature.appPath);
    expect(UPCOMING_FEATURES.map((feature) => feature.name)).toEqual(screens.map((feature) => feature.name));
  });
});
