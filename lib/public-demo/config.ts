import { LANGUAGES, PRODUCT_COUNTRIES, detectLanguage, isSupportedProfile, profileForLanguage, proposedProfile, type Language, type LocaleProfile, type ProductCountry } from "@/lib/localization/config";

/**
 * Public demo: a read-only sample account per product country and interface language (Italy: Italian and English,
 * Germany: English and German, another country: English) that anyone can open from the landing without signing up (`/demo`). Pure helpers shared by the proxy, the auth plugin, the cron that rebuilds the data and the UI.
 */

/** Languages the demo can be shown in (every language of the app). */
export const PUBLIC_DEMO_LANGUAGES: readonly Language[] = LANGUAGES;
/**
 * Languages each country's demo exists in. A country without local rules (`OTHER`) has only the English demo: a visitor
 * from there who reads Italian or German is shown the Italian or German one.
 */
const DEMO_COUNTRY_LANGUAGES: Record<ProductCountry, readonly Language[]> = { IT: ["it", "en"], DE: ["en", "de"], OTHER: ["en"] };
/** One demo account per country and language pair: IT it, IT en, DE en, DE de, OTHER en. */
export const PUBLIC_DEMO_PROFILES: readonly LocaleProfile[] = PRODUCT_COUNTRIES.flatMap((productCountry) =>
  DEMO_COUNTRY_LANGUAGES[productCountry].map((language) => ({ productCountry, language })),
);
/** Language a country's demo opens in when the visitor's language is not offered there. */
const DEFAULT_COUNTRY_LANGUAGE: Record<ProductCountry, Language> = { IT: "it", DE: "de", OTHER: "en" };

/** True when a demo account exists for the pair. */
function hasDemo({ productCountry, language }: LocaleProfile): boolean {
  return DEMO_COUNTRY_LANGUAGES[productCountry].includes(language);
}
/** Every demo account id starts with this prefix: the read-only guards recognise demo sessions by it. */
export const PUBLIC_DEMO_USER_PREFIX = "public-demo-";
/** A demo session lasts this long; the cookie also ends when the browser closes. */
export const PUBLIC_DEMO_SESSION_HOURS = 2;
/** Error code returned by every write a demo session attempts. */
export const PUBLIC_DEMO_READ_ONLY_CODE = "demo_read_only";
/** Message shown for a blocked write (Italian source key, translated by the catalog). */
export const PUBLIC_DEMO_READ_ONLY_MESSAGE = "Nella demo non si salvano modifiche. Crea un account per usare l'app con i tuoi dati.";

/**
 * better-auth endpoints a demo session must not reach: they would change the shared account (profile, sessions,
 * linked sign-in methods) or delete it. Sign-out and session reads stay allowed.
 */
export const PUBLIC_DEMO_BLOCKED_AUTH_PATHS: ReadonlySet<string> = new Set([
  "/update-user",
  "/delete-user",
  "/change-email",
  "/change-password",
  "/set-password",
  "/link-social",
  "/unlink-account",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/update-session",
]);

/** Id of the demo account of a country and language, e.g. `public-demo-de-en`. */
export function publicDemoUserId({ productCountry, language }: LocaleProfile): string {
  return `${PUBLIC_DEMO_USER_PREFIX}${productCountry.toLowerCase()}-${language}`;
}

/** True for a demo account id (never true for real users, whose ids are random). */
export function isPublicDemoUserId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(PUBLIC_DEMO_USER_PREFIX);
}

/** The demo is off unless `PUBLIC_DEMO_ENABLED=true` (self-hosted instances have no demo accounts). */
export function isPublicDemoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PUBLIC_DEMO_ENABLED === "true";
}

/**
 * Demo to open from `?country=IT|DE|OTHER` and `?lang=it|en|de` (both optional), the visitor's country (`CF-IPCountry`)
 * and the browser's languages. A pair that has a demo is used as is; a lone country takes the language asked for, else
 * the detected one, when that country offers it, else its own language; with no country the visitor's country and
 * language decide, as on the sign-in page (a visitor from the US gets the English demo without Italian or German rules).
 */
export function pickPublicDemoProfile(
  countryParam: string | null | undefined,
  languageParam: string | null | undefined,
  acceptLanguage: string | null | undefined,
  visitorCountry?: string | null,
): LocaleProfile {
  const country = PRODUCT_COUNTRIES.find((candidate) => candidate === countryParam);
  const language = PUBLIC_DEMO_LANGUAGES.find((candidate) => candidate === languageParam);
  if (country && language && hasDemo({ productCountry: country, language })) return { productCountry: country, language };
  const proposed = proposedProfile({ chosenLanguage: language, country: visitorCountry, acceptLanguage });
  if (country) {
    const wanted = language ?? (visitorCountry ? proposed.language : detectLanguage(acceptLanguage));
    return { productCountry: country, language: hasDemo({ productCountry: country, language: wanted }) ? wanted : DEFAULT_COUNTRY_LANGUAGE[country] };
  }
  return hasDemo(proposed) ? proposed : profileForLanguage(proposed.language);
}

/** HTTP methods a demo session may use on the app's API: reads only. */
export function isReadOnlyMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

/** Profile of a demo session for its messages and metrics: the account's own, English for Italy if it is somehow missing. */
export function publicDemoSessionProfile(user: { language?: string | null; productCountry?: string | null }): LocaleProfile {
  const { language, productCountry } = user;
  return isSupportedProfile(productCountry, language)
    ? { productCountry: productCountry as ProductCountry, language: language as Language }
    : { productCountry: "IT", language: "en" };
}
