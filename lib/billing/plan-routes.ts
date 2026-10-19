/**
 * What the Free plan opens and what needs Pro. Free is Liquidità: accounts, movements, analysis, categories, rules,
 * subscriptions, imports, settings and help. Everything else (Panoramica, Investimenti, Debiti, Pensione, Analitiche)
 * is Pro. One list for pages and APIs, used by the proxy, the navigation and the upgrade page; it composes with the
 * country policy (`isCountryPathAvailable`), which runs first: a screen hidden in a country is never offered as Pro.
 */

/** Pro areas, in navigation order, with the page that represents them. */
export const PRO_AREAS = [
  { id: "panoramica", path: "/panoramica" },
  { id: "investimenti", path: "/investimenti" },
  { id: "pensione", path: "/pensione" },
  { id: "debiti", path: "/debiti" },
  { id: "analitiche", path: "/analitiche" },
] as const;
export type ProAreaId = (typeof PRO_AREAS)[number]["id"];

/** API prefixes behind Pro (the data of the Pro areas). `/api/net-worth` stays open: Liquidità draws its cash history from it. */
const PRO_API_PREFIXES = [
  "/api/investments",
  "/api/instruments",
  "/api/debts",
  "/api/pension",
  "/api/analytics",
  "/api/goals",
  "/api/financial-planning",
  "/api/sidebar",
] as const;

/** Page of the plans, open to everyone (also the target of every locked page). */
export const PRO_PAGE_PATH = "/pro";

/** Free landing page: what a Free account opens instead of a Pro home page. */
export const FREE_HOME_PATH = "/liquidita";

const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** The Pro area a path belongs to, or null when the Free plan opens it. */
export function proAreaOf(path: string): ProAreaId | null {
  return PRO_AREAS.find((area) => within(path, area.path))?.id ?? null;
}

/** True when the path needs Pro (a Pro page or a Pro API). */
export function isProPath(path: string): boolean {
  return proAreaOf(path) !== null || PRO_API_PREFIXES.some((prefix) => within(path, prefix));
}

/** True when an account on this plan can open the path. */
export function isPlanPathAvailable(tier: "free" | "pro", path: string): boolean {
  return tier === "pro" || !isProPath(path);
}

/** Valid `?da=` value of the plans page (the locked area the user came from), or null. */
export function parseProArea(value: string | null | undefined): ProAreaId | null {
  return PRO_AREAS.find((area) => area.id === value)?.id ?? null;
}
