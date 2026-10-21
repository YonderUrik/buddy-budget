import { isPlanningAvailable } from "./planning-availability";
import { financialCountry, DISABLED_FINANCIAL_FEATURES } from "./financial-country";
/**
 * Product rules and interface language are independent account preferences. `OTHER` is every country whose tax and
 * pension rules the app does not model yet: everything that does not depend on local rules works there.
 */
export const PRODUCT_COUNTRIES = ["IT", "DE", "OTHER"] as const;
export const LANGUAGES = ["it", "en", "de"] as const;
export type ProductCountry = (typeof PRODUCT_COUNTRIES)[number];
export type Language = (typeof LANGUAGES)[number];
export interface LocaleProfile { productCountry: ProductCountry; language: Language }
export const COUNTRY_LANGUAGES: Record<ProductCountry, readonly Language[]> = { IT: ["it", "en"], DE: ["en", "de"], OTHER: ["en", "it", "de"] };
/** Name of each product country (Italian source keys, translated by the catalogs). */
export const PRODUCT_COUNTRY_NAMES: Record<ProductCountry, string> = { IT: "Italia", DE: "Germania", OTHER: "Altro paese" };
/**
 * What a country does not have yet, said where a section is off (Italian source keys). One shared sentence per
 * country, so the settings, the «not available» page and the API error all say the same thing.
 */
export const COUNTRY_UNAVAILABLE_NOTES: Record<ProductCountry, string | null> = {
  IT: null,
  DE: "Per la Germania la pensione non è ancora disponibile. I dati esistenti vengono conservati.",
  OTHER: "Tasse e pensione seguono le regole italiane e tedesche: per il tuo paese arriveranno presto. Tutto il resto funziona.",
};
/** Error of a page or API that the user's country does not have yet (Italian source key). */
export const COUNTRY_UNAVAILABLE_MESSAGE = "Non ancora disponibile nel tuo paese. Arriverà presto.";
export const LANGUAGE_NAMES: Record<Language, string> = { it: "Italiano", en: "English", de: "Deutsch" };
export const LANGUAGE_LOCALES: Record<Language, string> = { it: "it-IT", en: "en-GB", de: "de-DE" };
export const LANGUAGE_COOKIE = "bb-language";
/** Request header with the visitor's country (ISO 3166 alpha-2), added by Cloudflare in front of the hosted service. */
export const COUNTRY_HEADER = "cf-ipcountry";
/** Interface language of a number/date locale ("en-GB" → "en"); unknown locales fall back to English. */
export function languageOfLocale(locale: string): Language {
  const primary = locale.slice(0, 2).toLowerCase();
  return LANGUAGES.includes(primary as Language) ? (primary as Language) : "en";
}
export const DEFAULT_PROFILE: LocaleProfile = { productCountry: "IT", language: "it" };

/**
 * Interface language from the browser's `Accept-Language` header, for visitors who have not chosen one: the most
 * preferred supported language wins (`de-AT` counts as `de`). A browser that asks only for unsupported languages gets
 * English; no header at all (bots, scripts) keeps the Italian default.
 */
export function detectLanguage(acceptLanguage: string | null | undefined): Language {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = Number(params.map((param) => param.trim()).find((param) => param.startsWith("q="))?.slice(2) ?? 1);
      return { primary: tag.split("-")[0], q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((entry) => entry.primary && entry.primary !== "*" && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  if (ranked.length === 0) return DEFAULT_PROFILE.language;
  return (ranked.find((entry) => LANGUAGES.includes(entry.primary as Language))?.primary as Language | undefined) ?? "en";
}
/**
 * Visitor's country from the request headers (`CF-IPCountry`), or null without one (self-hosted, local development,
 * Cloudflare's `XX` unknown and `T1` Tor values).
 */
export function detectCountry(headers: { get(name: string): string | null } | null | undefined): string | null {
  const value = headers?.get(COUNTRY_HEADER)?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1" ? value : null;
}

/** Languages spoken in the countries that have one of ours; the first is the default, the others win only when the browser asks for them. */
const COUNTRY_LOCAL_LANGUAGES: Readonly<Record<string, readonly Language[]>> = {
  IT: ["it"], SM: ["it"], VA: ["it"],
  DE: ["de"], AT: ["de"], LI: ["de"],
  CH: ["de", "it"],
};

/** Product rules of a visitor's country: Italy and Germany have theirs, every other country gets `OTHER`. */
export function productCountryFor(country: string): ProductCountry {
  return country === "IT" || country === "DE" ? country : "OTHER";
}

/**
 * Profile proposed to a visitor who has not chosen one. The country decides when it is known: Italy and Italian-speaking
 * countries get Italian, German-speaking ones German, everyone else English (a visitor from the US always starts in
 * English, whatever the browser says); the user can change both afterwards. Without a country, the browser language
 * decides, as before.
 */
export function detectProfile(input: { country?: string | null; acceptLanguage?: string | null }): LocaleProfile {
  const country = input.country ? input.country.toUpperCase() : null;
  if (!country) return profileForLanguage(detectLanguage(input.acceptLanguage));
  const local = COUNTRY_LOCAL_LANGUAGES[country] ?? ["en"];
  const browser = input.acceptLanguage ? detectLanguage(input.acceptLanguage) : null;
  const language = browser && local.includes(browser) ? browser : local[0];
  return { productCountry: productCountryFor(country), language };
}

/**
 * Profile of a visitor who has not finished onboarding: the language picked by hand (if any) wins over the detected
 * one, and the detected country is kept when it offers that language.
 */
export function proposedProfile(input: { chosenLanguage?: string | null; country?: string | null; acceptLanguage?: string | null }): LocaleProfile {
  const detected = detectProfile(input);
  const chosen = LANGUAGES.find((language) => language === input.chosenLanguage);
  if (!chosen || chosen === detected.language) return detected;
  return isSupportedProfile(detected.productCountry, chosen) ? { productCountry: detected.productCountry, language: chosen } : profileForLanguage(chosen);
}

/** Profile proposed for a language before the user picks a country: German implies the German product rules. */
export function profileForLanguage(language: Language): LocaleProfile {
  return { productCountry: language === "de" ? "DE" : "IT", language };
}
/** Validate a complete country/language pair before persisting it. */
export function isSupportedProfile(country: unknown, language: unknown): boolean {
  return PRODUCT_COUNTRIES.includes(country as ProductCountry) && COUNTRY_LANGUAGES[country as ProductCountry].includes(language as Language);
}
/** Safe defaults for existing accounts; unrecognized stored values fall back to the legacy Italian profile. */
export function resolveProfile(user?: { productCountry?: string | null; language?: string | null } | null): LocaleProfile {
  const productCountry: ProductCountry = user?.productCountry === "DE" || user?.productCountry === "OTHER" ? user.productCountry : "IT";
  const language = isSupportedProfile(productCountry, user?.language) ? user!.language as Language : productCountry === "IT" ? "it" : "en";
  return { productCountry, language };
}
/** Shared legacy-engine capabilities; dedicated country planning screens use the separate route policy below. */
export function countryFeatures(country: string) {
  return financialCountry(country)?.features ?? DISABLED_FINANCIAL_FEATURES;
}
const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
/**
 * Central route policy used by navigation, proxy and protected API handlers: pages and APIs that depend on a
 * country's tax, pension or planning rules exist only where those rules are modelled. Other gates (such as the
 * subscription plan) compose with it: a section is reachable when every gate allows it, and the country answer
 * comes first because no plan unlocks rules the app does not have.
 */
export function isCountryPathAvailable(country: string, path: string): boolean {
  if (country === "IT") return true;
  // The Italian pension fund and the Italian loss carry-forward (zainetto fiscale) exist only in Italy.
  if (["/pensione", "/api/pension", "/api/investments/tax-carryforwards"].some(prefix => within(path, prefix))) return false;
  if (country === "DE") {
    // Dedicated German tax and income screens; the Italian subpages under them stay closed.
    for (const [route, capability] of [["/investimenti/tasse", "tax"], ["/investimenti/proventi", "income"]] as const) {
      if (within(path, route)) return path === route && isPlanningAvailable(country, capability);
    }
    return true;
  }
  // No local tax rules: no tax screens. Everything else (income, Analitiche, goals) runs without taxes.
  return !["/investimenti/tasse", "/api/financial-planning"].some(prefix => within(path, prefix));
}
