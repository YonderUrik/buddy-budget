import { LANGUAGES, type Language, type LocaleProfile } from "@/lib/localization/config";

/**
 * Public demo: a read-only sample account per interface language that anyone can open from the landing without
 * signing up (`/demo`). Pure helpers shared by the proxy, the auth plugin, the cron that rebuilds the data and the UI.
 */

/** Languages with their own demo account. */
export const PUBLIC_DEMO_LANGUAGES: readonly Language[] = LANGUAGES;
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

/** Id of the demo account for a language. */
export function publicDemoUserId(language: Language): string {
  return `${PUBLIC_DEMO_USER_PREFIX}${language}`;
}

/** True for a demo account id (never true for real users, whose ids are random). */
export function isPublicDemoUserId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(PUBLIC_DEMO_USER_PREFIX);
}

/** Product rules of each demo: English shows the Italian rules (the complete feature set), German the German ones. */
export function publicDemoProfile(language: Language): LocaleProfile {
  return { productCountry: language === "de" ? "DE" : "IT", language };
}

/** The demo is off unless `PUBLIC_DEMO_ENABLED=true` (self-hosted instances have no demo accounts). */
export function isPublicDemoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PUBLIC_DEMO_ENABLED === "true";
}

/**
 * Language of the demo to open: `?lang=` when supported, else the first supported language in `Accept-Language`,
 * else English (most visitors without Italian or German are better served by it).
 */
export function pickPublicDemoLanguage(param: string | null | undefined, acceptLanguage: string | null | undefined): Language {
  if (param && (PUBLIC_DEMO_LANGUAGES as readonly string[]).includes(param)) return param as Language;
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { language: tag.toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((entry) => entry.language && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  const match = preferred.find((entry) => (PUBLIC_DEMO_LANGUAGES as readonly string[]).includes(entry.language));
  return (match?.language as Language | undefined) ?? "en";
}

/** HTTP methods a demo session may use on the app's API: reads only. */
export function isReadOnlyMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}
