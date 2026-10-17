/**
 * Page pairs between the Italian and the English site: the single list behind hreflang, the sitemap, the «IT / EN»
 * switch and the tests. Pages without an English version (calculators, guides, legal pages) are not here: from them
 * the switch goes to the English home.
 */
import type { Metadata } from "next";
import { HTML_LANG, type Locale } from "@/lib/i18n";
import { CONTENT_PATHS } from "./seo-pages";

/** Paths of the English pages. */
export const EN_PATHS = {
  home: "/en",
  security: "/en/security",
  features: "/en/features",
  featureInvestments: "/en/features/investments",
  screens: "/en/screens",
} as const;

export interface PagePair {
  it: string;
  en: string;
}

export const PAGE_PAIRS: readonly PagePair[] = [
  { it: "/", en: EN_PATHS.home },
  { it: CONTENT_PATHS.sicurezza, en: EN_PATHS.security },
  { it: CONTENT_PATHS.funzioni, en: EN_PATHS.features },
  { it: CONTENT_PATHS.funzioneInvestimenti, en: EN_PATHS.featureInvestments },
  { it: CONTENT_PATHS.schermate, en: EN_PATHS.screens },
];

/** Home of each language: where the switch goes from a page that has no counterpart. */
export const HOME_PATH: Record<Locale, string> = { it: "/", en: EN_PATHS.home };

/** The same page in the language `to`, or that language's home when the page exists in one language only. */
export function counterpart(path: string, to: Locale): string {
  const pair = PAGE_PAIRS.find((p) => p.it === path || p.en === path);
  return pair ? pair[to] : HOME_PATH[to];
}

/**
 * `alternates` of a page that exists in both languages: its own canonical plus hreflang it / en / x-default.
 * `x-default` is the English page: a visitor whose language is neither Italian nor English reads English better.
 */
export function languageAlternates(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  const pair = PAGE_PAIRS.find((p) => p[locale] === path);
  if (!pair) throw new Error(`Page without a language pair: ${path}`);
  return {
    canonical: pair[locale],
    languages: { [HTML_LANG.it]: pair.it, [HTML_LANG.en]: pair.en, "x-default": pair.en },
  };
}
