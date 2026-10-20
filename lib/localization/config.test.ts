import { describe, expect, it } from "vitest";
import { countryFeatures, detectCountry, detectLanguage, detectProfile, isCountryPathAvailable, isSupportedProfile, profileForLanguage, proposedProfile, resolveProfile } from "./config";
import { translate, messages } from "./messages";
import { localizedFormats } from "./format";
import { localizedCategoryProposal } from "./categories";
import en from "./catalogs/en.json";
import de from "./catalogs/de.json";

describe("independent product countries and languages", () => {
  it("supports the requested combinations and keeps legacy accounts Italian", () => {
    expect(resolveProfile()).toEqual({ productCountry: "IT", language: "it" });
    expect(resolveProfile({ productCountry: "OTHER", language: "fr" })).toEqual({ productCountry: "OTHER", language: "en" });
    expect(resolveProfile({ productCountry: "US", language: "en" })).toEqual({ productCountry: "IT", language: "en" });
    for (const [country, language] of [["IT", "it"], ["IT", "en"], ["DE", "en"], ["DE", "de"], ["OTHER", "en"], ["OTHER", "it"], ["OTHER", "de"]]) expect(isSupportedProfile(country, language)).toBe(true);
    for (const [country, language] of [["IT", "de"], ["DE", "it"], ["US", "en"], ["DE", "fr"]]) expect(isSupportedProfile(country, language)).toBe(false);
    expect(countryFeatures(resolveProfile({ productCountry: "IT", language: "en" }).productCountry).taxes).toBe(true);
    expect(countryFeatures("DE")).toEqual({ taxes: false, pension: false, retirement: false, incomeForecasts: false, inflation: true });
  });
  it("keeps legacy Italian APIs and subpages blocked while exposing only essential German screens", () => {
    for (const path of ["/pensione", "/analitiche", "/pensione/", "/analitiche/", "/pensione/dati", "/analitiche/fire", "/api/pension/funds/123", "/api/analytics/assumptions", "/api/sidebar/fire", "/api/investments/tax-carryforwards"]) {
      expect(isCountryPathAvailable("DE", path), path).toBe(false);
      expect(isCountryPathAvailable("IT", path), path).toBe(true);
    }
    for (const path of ["/investimenti/tasse", "/investimenti/proventi", "/api/financial-planning", "/investimenti", "/investimenti/performance", "/api/investments/overview", "/api/user/export", "/liquidita", "/debiti", "/api/pension-other"]) expect(isCountryPathAvailable("DE", path)).toBe(true);
  });
  it("gives other countries everything that does not depend on local rules", () => {
    expect(countryFeatures("OTHER")).toEqual({ taxes: false, pension: false, retirement: true, incomeForecasts: false, inflation: false });
    for (const path of ["/pensione", "/investimenti/tasse", "/investimenti/proventi", "/api/financial-planning", "/api/pension/funds", "/api/investments/tax-carryforwards"]) expect(isCountryPathAvailable("OTHER", path), path).toBe(false);
    for (const path of ["/panoramica", "/liquidita", "/investimenti", "/investimenti/performance", "/debiti", "/impostazioni", "/api/user/export", "/analitiche", "/analitiche/obiettivi", "/api/analytics/assumptions", "/api/goals", "/api/sidebar/fire"]) expect(isCountryPathAvailable("OTHER", path), path).toBe(true);
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

describe("country detection", () => {
  const headers = (init: Record<string, string>) => new Headers(init);
  it("reads Cloudflare's country header and ignores unknown values", () => {
    expect(detectCountry(headers({ "cf-ipcountry": "us" }))).toBe("US");
    for (const value of ["XX", "T1", "", "USA"]) expect(detectCountry(headers({ "cf-ipcountry": value }))).toBeNull();
    expect(detectCountry(headers({}))).toBeNull();
    expect(detectCountry(null)).toBeNull();
  });
  it("lands visitors in the language of their country, English everywhere else", () => {
    expect(detectProfile({ country: "US", acceptLanguage: "it-IT,it;q=0.9" })).toEqual({ productCountry: "OTHER", language: "en" });
    expect(detectProfile({ country: "IT", acceptLanguage: "en-US" })).toEqual({ productCountry: "IT", language: "it" });
    expect(detectProfile({ country: "DE", acceptLanguage: "en-US" })).toEqual({ productCountry: "DE", language: "de" });
    expect(detectProfile({ country: "AT" })).toEqual({ productCountry: "OTHER", language: "de" });
    expect(detectProfile({ country: "SM" })).toEqual({ productCountry: "OTHER", language: "it" });
    expect(detectProfile({ country: "CH", acceptLanguage: "it-CH" })).toEqual({ productCountry: "OTHER", language: "it" });
    expect(detectProfile({ country: "CH", acceptLanguage: "fr-CH" })).toEqual({ productCountry: "OTHER", language: "de" });
    expect(detectProfile({ country: "FR", acceptLanguage: "fr-FR" })).toEqual({ productCountry: "OTHER", language: "en" });
  });
  it("falls back to the browser language without a country", () => {
    expect(detectProfile({ acceptLanguage: "de-DE" })).toEqual({ productCountry: "DE", language: "de" });
    expect(detectProfile({ acceptLanguage: "en-US" })).toEqual({ productCountry: "IT", language: "en" });
    expect(detectProfile({})).toEqual({ productCountry: "IT", language: "it" });
  });
  it("keeps a language picked by hand and the country when it offers that language", () => {
    expect(proposedProfile({ chosenLanguage: "it", country: "US" })).toEqual({ productCountry: "OTHER", language: "it" });
    expect(proposedProfile({ chosenLanguage: "de", country: "IT" })).toEqual({ productCountry: "DE", language: "de" });
    expect(proposedProfile({ chosenLanguage: "en", country: "IT" })).toEqual({ productCountry: "IT", language: "en" });
    expect(proposedProfile({ chosenLanguage: "fr", country: "US" })).toEqual({ productCountry: "OTHER", language: "en" });
  });
});

describe("browser language detection", () => {
  it("picks the most preferred supported language, region and weights included", () => {
    expect(detectLanguage("de-AT,de;q=0.9,en;q=0.8")).toBe("de");
    expect(detectLanguage("en-US,en;q=0.9,it;q=0.8")).toBe("en");
    expect(detectLanguage("fr-FR,fr;q=0.9,it;q=0.8,en;q=0.7")).toBe("it");
    expect(detectLanguage("en;q=0.5, de;q=0.9")).toBe("de");
    expect(detectLanguage("IT")).toBe("it");
  });
  it("falls back to English for unsupported languages and to Italian without a header", () => {
    expect(detectLanguage("fr-FR,es;q=0.5")).toBe("en");
    expect(detectLanguage("de;q=0, fr")).toBe("en");
    expect(detectLanguage(null)).toBe("it");
    expect(detectLanguage("")).toBe("it");
    expect(detectLanguage("*")).toBe("it");
  });
  it("proposes the German product rules only with German", () => {
    for (const language of ["it", "en", "de"] as const) expect(isSupportedProfile(profileForLanguage(language).productCountry, language)).toBe(true);
    expect(profileForLanguage("de").productCountry).toBe("DE");
    expect(profileForLanguage("en").productCountry).toBe("IT");
  });
});
