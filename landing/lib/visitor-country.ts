/**
 * The visitor's country, as nginx passes it from Cloudflare (`CF-IPCountry`) in the `bb-country` cookie, and what the
 * landing does with it before the first paint: the language to land on (an Italian page sends a visitor from outside
 * Italy to its English counterpart) and which product rules apply (`<html data-rules>`), so blocks that only exist
 * with Italian rules (pension fund, Italian taxes) are hidden by CSS. Without the cookie (self-hosted copies, bots,
 * no header) nothing changes. The pure functions below are the reference; the inline scripts repeat them in a few
 * bytes and the tests check that both agree.
 */
import type { Locale } from "./i18n";

/** Cookie set by `nginx.conf` on HTML responses: the ISO alpha-2 country of the visitor, for one day. */
export const COUNTRY_COOKIE = "bb-country";

/** localStorage key holding the language the visitor chose by hand (language menu or «also in English» bar). */
export const LANGUAGE_CHOICE_STORAGE_KEY = "bb-landing-language";

/** sessionStorage flag left by the automatic switch, read on the English page to send `language_auto_switched`. */
export const AUTO_SWITCH_FLAG = "bb-language-auto";

/** Countries whose visitors land on Italian. */
export const ITALIAN_COUNTRIES: readonly string[] = ["IT", "SM", "VA"];

/** Countries where Italian is one of the languages: Italian only when the browser's first language is Italian. */
export const ITALIAN_IF_BROWSER: readonly string[] = ["CH"];

/** Product rules for a country: Italian rules in full, German rules in part, or none yet. */
export type CountryRules = "it" | "de" | "none";

/**
 * Which variant of the page a visitor sees: `full` is everything (Italy, or no country known: bots and self-hosted
 * copies), `de` drops the Italian pension fund, `none` also drops the Italian taxes. Everything else shows everywhere.
 */
export type RulesVariant = "full" | "de" | "none";

export const RULES_VARIANTS: readonly RulesVariant[] = ["full", "de", "none"];

/** What a block needs to make sense: the Italian pension fund or tax rules. */
export type RuleNeed = "pension" | "taxes";

/** A text that changes with the visitor's rules: `de` falls back to `full`, `none` to `de`. */
export type ByRules = string | { full: string; de?: string; none?: string };

/** The line shown where blocks were hidden: one for Germany (optional), one for countries without rules yet. */
export interface RulesNoteText {
  /** For visitors from Germany (the Italian pension fund is missing); without it they see nothing. */
  de?: string;
  none: string;
}

/** A real country code from the cookie, or null (missing, malformed, `XX` unknown, `T1` Tor). */
export function parseCountry(raw: string | null | undefined): string | null {
  if (!raw || !/^[A-Z]{2}$/.test(raw) || raw === "XX") return null;
  return raw;
}

/** The `bb-country` cookie in a `document.cookie` string, or null. */
export function countryFromCookie(cookie: string): string | null {
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COUNTRY_COOKIE}=([^;]*)`));
  return parseCountry(match?.[1]);
}

/** Landing language for a country: Italian for Italy, San Marino and the Vatican (Switzerland with an Italian browser), English elsewhere. */
export function countryLanguage(country: string, browserLanguage = ""): Locale {
  if (ITALIAN_COUNTRIES.includes(country)) return "it";
  if (ITALIAN_IF_BROWSER.includes(country) && /^it\b/i.test(browserLanguage)) return "it";
  return "en";
}

/** Product rules of a country. */
export function countryRules(country: string): CountryRules {
  if (ITALIAN_COUNTRIES.includes(country)) return "it";
  return country === "DE" ? "de" : "none";
}

/** Page variant for `<html data-rules>` (missing: the full page). */
export function rulesVariant(rules: CountryRules | null | undefined): RulesVariant {
  return rules === "de" || rules === "none" ? rules : "full";
}

/** Whether a block that needs `needs` is hidden in a variant: pension outside Italy, taxes where no rules exist yet. */
export function hiddenIn(needs: RuleNeed | readonly RuleNeed[] | undefined, variant: RulesVariant): boolean {
  const list = needs === undefined ? [] : typeof needs === "string" ? [needs] : needs;
  return list.some((n) => (n === "pension" ? variant !== "full" : variant === "none"));
}

/** Value of the `data-needs` attribute (space-separated), or undefined when the block is for everyone. */
export function needsAttr(needs: RuleNeed | readonly RuleNeed[] | undefined): string | undefined {
  if (needs === undefined) return undefined;
  const list = typeof needs === "string" ? [needs] : needs;
  return list.length ? list.join(" ") : undefined;
}

/** The distinct texts of a `ByRules`, each with the variants that show it (one entry when it never changes). */
export function rulesTexts(text: ByRules): { text: string; variants: RulesVariant[] }[] {
  if (typeof text === "string") return [{ text, variants: [...RULES_VARIANTS] }];
  const de = text.de ?? text.full;
  const byVariant: Record<RulesVariant, string> = { full: text.full, de, none: text.none ?? de };
  const out: { text: string; variants: RulesVariant[] }[] = [];
  for (const variant of RULES_VARIANTS) {
    const found = out.find((o) => o.text === byVariant[variant]);
    if (found) found.variants.push(variant);
    else out.push({ text: byVariant[variant], variants: [variant] });
  }
  return out;
}

export interface AutoLanguageInput {
  /** `location.pathname` of an Italian page. */
  path: string;
  search: string;
  hash: string;
  /** Country from the cookie (already parsed), or null. */
  country: string | null;
  /** The browser's first language (`navigator.languages[0]`). */
  browserLanguage: string;
  /** Language stored by an explicit choice, or null. */
  choice: string | null;
  /** Italian path → English path (`PAGE_PAIRS`). */
  pairs: Readonly<Record<string, string>>;
  /** Where a page without an English counterpart goes. */
  fallback: string;
}

/**
 * Where an Italian page sends the visitor before the first paint, or null to stay: only with a country cookie whose
 * language is not Italian, no `?lang=` in the address and no explicit choice of Italian. Query and hash are kept.
 */
export function autoLanguageTarget(input: AutoLanguageInput): string | null {
  const { path, search, hash, country, browserLanguage, choice, pairs, fallback } = input;
  if (!country || choice === "it" || new URLSearchParams(search).has("lang")) return null;
  if (path === fallback || path.startsWith(`${fallback}/`)) return null;
  if (countryLanguage(country, browserLanguage) === "it") return null;
  return `${pairs[path] ?? fallback}${search}${hash}`;
}

const COOKIE_READ = `document.cookie.match(/(?:^|;\\s*)${COUNTRY_COOKIE}=([A-Z]{2})(?:;|$)/)`;

/**
 * Inline script for every page: `<html data-rules>` from the cookie (`it`, `de` or `none`), nothing without it.
 * Same result as `countryRules(countryFromCookie(document.cookie))`.
 */
export const RULES_SCRIPT = `try{var m=${COOKIE_READ},c=m&&m[1];if(c&&c!=="XX")document.documentElement.dataset.rules=${JSON.stringify(ITALIAN_COUNTRIES)}.indexOf(c)>=0?"it":c==="DE"?"de":"none"}catch(e){}`;

/**
 * Inline script for the Italian pages, built from `pairs` (Italian → English paths): replaces the page with its
 * English counterpart before the first paint when `autoLanguageTarget` says so, and leaves the flag for the event.
 * Storage that throws means no redirect (a choice could not be remembered).
 */
export function autoLanguageScript(pairs: Readonly<Record<string, string>>, fallback: string): string {
  return `try{var m=${COOKIE_READ},c=m&&m[1],l=location,q=l.search,p=l.pathname,b=(navigator.languages&&navigator.languages[0])||navigator.language||"";if(c&&c!=="XX"&&!new URLSearchParams(q).has("lang")&&localStorage.getItem("${LANGUAGE_CHOICE_STORAGE_KEY}")!=="it"&&p!=="${fallback}"&&p.indexOf("${fallback}/")!==0&&${JSON.stringify(ITALIAN_COUNTRIES)}.indexOf(c)<0&&!(${JSON.stringify(ITALIAN_IF_BROWSER)}.indexOf(c)>=0&&/^it\\b/i.test(b))){var t=${JSON.stringify(pairs)}[p]||"${fallback}";try{sessionStorage.setItem("${AUTO_SWITCH_FLAG}","1")}catch(e){}document.documentElement.style.visibility="hidden";l.replace(t+q+l.hash)}}catch(e){}`;
}

/** The language the visitor chose by hand on the landing, or null (none, unknown value, storage blocked). */
export function storedLanguageChoice(): Locale | null {
  try {
    const value = localStorage.getItem(LANGUAGE_CHOICE_STORAGE_KEY);
    return value === "it" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

/** Remembers an explicit language choice, so the automatic switch never overrides it. */
export function rememberLanguageChoice(locale: Locale): void {
  try {
    localStorage.setItem(LANGUAGE_CHOICE_STORAGE_KEY, locale);
  } catch {
    // storage blocked: the choice holds for this page only
  }
}
