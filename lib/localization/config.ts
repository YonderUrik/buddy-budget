import { isPlanningAvailable } from "./planning-availability";
import { financialCountry, DISABLED_FINANCIAL_FEATURES } from "./financial-country";
/** Product rules and interface language are independent account preferences. */
export const PRODUCT_COUNTRIES = ["IT", "DE"] as const;
export const LANGUAGES = ["it", "en", "de"] as const;
export type ProductCountry = (typeof PRODUCT_COUNTRIES)[number];
export type Language = (typeof LANGUAGES)[number];
export interface LocaleProfile { productCountry: ProductCountry; language: Language }
export const COUNTRY_LANGUAGES: Record<ProductCountry, readonly Language[]> = { IT: ["it", "en"], DE: ["en", "de"] };
export const LANGUAGE_NAMES: Record<Language, string> = { it: "Italiano", en: "English", de: "Deutsch" };
export const LANGUAGE_LOCALES: Record<Language, string> = { it: "it-IT", en: "en-GB", de: "de-DE" };
export const LANGUAGE_COOKIE = "bb-language";
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
  const productCountry = user?.productCountry === "DE" ? "DE" : "IT";
  const language = isSupportedProfile(productCountry, user?.language) ? user!.language as Language : productCountry === "DE" ? "en" : "it";
  return { productCountry, language };
}
/** Shared legacy-engine capabilities; dedicated country planning screens use the separate route policy below. */
export function countryFeatures(country: string) {
  return financialCountry(country)?.features ?? DISABLED_FINANCIAL_FEATURES;
}
const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
/** Central route policy used by navigation, proxy and protected API handlers. */
export function isCountryPathAvailable(country: string, path: string): boolean {
  if (country === "IT") return true;
  // Dedicated German screens; legacy Italian APIs and subpages stay inaccessible.
  const planningRoutes = { "/pensione": "pension", "/analitiche": "retirement", "/investimenti/tasse": "tax", "/investimenti/proventi": "income" } as const;
  if (Object.hasOwn(planningRoutes, path)) return isPlanningAvailable(country, planningRoutes[path as keyof typeof planningRoutes]);
  if (country === "DE" && path === "/api/financial-planning") return true;
  return ![
    "/pensione", "/analitiche", "/investimenti/tasse", "/investimenti/proventi",
    "/api/pension", "/api/analytics", "/api/goals", "/api/sidebar/fire", "/api/investments/tax-carryforwards",
  ].some(prefix => within(path, prefix));
}
