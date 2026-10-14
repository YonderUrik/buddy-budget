import { describe, expect, it } from "vitest";
import { countryFeatures, isCountryPathAvailable, isSupportedProfile, resolveProfile } from "./config";
import { translate, messages } from "./messages";
import { localizedFormats } from "./format";
import { localizedCategoryProposal } from "./categories";
import en from "./catalogs/en.json";
import de from "./catalogs/de.json";

describe("independent product countries and languages", () => {
  it("supports exactly the four requested combinations and keeps legacy accounts Italian", () => {
    expect(resolveProfile()).toEqual({ productCountry: "IT", language: "it" });
    for (const [country, language] of [["IT", "it"], ["IT", "en"], ["DE", "en"], ["DE", "de"]]) expect(isSupportedProfile(country, language)).toBe(true);
    for (const [country, language] of [["IT", "de"], ["DE", "it"], ["US", "en"], ["DE", "fr"]]) expect(isSupportedProfile(country, language)).toBe(false);
    expect(countryFeatures(resolveProfile({ productCountry: "IT", language: "en" }).productCountry).taxes).toBe(true);
    expect(countryFeatures("DE")).toEqual({ taxes: false, pension: false, retirement: false, incomeForecasts: false, inflation: true });
  });
  it("keeps legacy Italian APIs and subpages blocked while enabling dedicated German screens", () => {
    for (const path of ["/pensione/dati", "/analitiche/fire", "/api/pension/funds/123", "/api/analytics/assumptions", "/api/sidebar/fire", "/api/investments/tax-carryforwards"]) {
      expect(isCountryPathAvailable("DE", path), path).toBe(false);
      expect(isCountryPathAvailable("IT", path), path).toBe(true);
    }
    for (const path of ["/pensione", "/analitiche", "/investimenti/tasse", "/investimenti/proventi", "/api/financial-planning", "/investimenti", "/investimenti/performance", "/api/investments/overview", "/api/user/export", "/liquidita", "/debiti", "/api/pension-other"]) expect(isCountryPathAvailable("DE", path)).toBe(true);
  });
  it("has matching catalogs and preserves interpolation values", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    const slots = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
    for (const [source, values] of Object.entries(messages)) for (const value of values) expect(slots(value), source).toEqual(slots(source));
    expect(translate("de", "Imposte registrate: {0}.", { 0: "12,00 €" })).toBe("Erfasste Steuern: 12,00 €.");
    expect(translate("en", null)).toBeNull();
    expect(translate("en", "My own account name")).toBe("My own account name");
  });
  it("formats independently without leaking locale across users", () => {
    const english = localizedFormats("en-GB"), german = localizedFormats("de-DE");
    expect(english.formatCurrency(1234.56, "EUR")).toBe("€1,234.56");
    expect(german.formatCurrency(1234.56, "EUR")).toBe("1.234,56 €");
    expect(english.formatCurrency(1234.56, "EUR")).toBe("€1,234.56");
    expect(german.formatShortDate("2026-10-13")).toContain("Okt");
    expect(english.formatRelativeTime(new Date("2026-10-12"), new Date("2026-10-13"))).toBe("yesterday");
  });
  it("proposes translated categories without Italian tax examples in Germany", () => {
    const german = localizedCategoryProposal({ productCountry: "DE", language: "de" });
    expect(german.find(c => c.key === "affitto")?.name).toBe("Miete & Immobilienkredit");
    expect(german.find(c => c.key === "tasse")?.description).toBe("Steuern und Abgaben");
    expect(german.find(c => c.key === "rimborsi")?.description).not.toContain("730");
    const englishItaly = localizedCategoryProposal({ productCountry: "IT", language: "en" });
    expect(englishItaly.find(c => c.key === "tasse")?.description).toContain("F24");
  });
});
