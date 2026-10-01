import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/layout/sidebar";
import { UPCOMING_FEATURES } from "@/components/domain/auth/upcoming-features.data";
import { FEATURES, featuresByStatus } from "./catalog";

describe("catalogo funzionalità", () => {
  it("ha id unici", () => {
    const ids = FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ogni voce di sidebar ha la sua scheda, con lo stesso stato", () => {
    for (const item of NAV_ITEMS) {
      const feature = FEATURES.find((candidate) => candidate.appPath === item.href);
      expect(feature, `manca la scheda del catalogo per ${item.href}`).toBeDefined();
      expect(feature?.status).toBe(item.comingSoon ? "soon" : "live");
    }
  });

  it("il pannello \"In arrivo\" del login mostra esattamente le funzionalità `soon`", () => {
    expect(UPCOMING_FEATURES.map((feature) => feature.name)).toEqual(featuresByStatus("soon").map((feature) => feature.name));
  });
});
