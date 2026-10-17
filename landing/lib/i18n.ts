/**
 * Languages of the landing. Italian lives at the root (`/`, `/sicurezza`…), English under `/en`; each language has its
 * own root layout (`app/(it)/layout.tsx`, `app/en/layout.tsx`) so `<html lang>` is right in the static HTML.
 */
export type Locale = "it" | "en";

export const LOCALES: readonly Locale[] = ["it", "en"];

/** Value of `<html lang>` and of `hreflang`. */
export const HTML_LANG: Record<Locale, string> = { it: "it", en: "en" };

/** `og:locale` of each language. */
export const OG_LOCALE: Record<Locale, string> = { it: "it_IT", en: "en_US" };

/** `inLanguage` of the schema.org data. */
export const SCHEMA_LANGUAGE: Record<Locale, string> = { it: "it-IT", en: "en" };

/** Short label of the language switch («IT / EN»). */
export const LOCALE_SHORT: Record<Locale, string> = { it: "IT", en: "EN" };

/** The other language: the switch only has two. */
export function otherLocale(locale: Locale): Locale {
  return locale === "it" ? "en" : "it";
}
