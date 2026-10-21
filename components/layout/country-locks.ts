import { track } from "@/lib/analytics";
import { isCountryPathAvailable } from "@/lib/localization/config";
import type { NavItem, NavLock } from "./sidebar";

/** Page that explains which sections a country does not have yet. */
export const COUNTRY_UNAVAILABLE_PATH = "/country-unavailable";

/** Sections whose demand is counted when a user opens them while closed in their country. */
const REQUESTABLE_SECTIONS = { "/pensione": "pensione" } as const;

/** Lock of a section the user's country does not have yet: «Presto» badge, explanation page, demand counted in Umami. */
export function countryLock(country: string, href: string): NavLock {
  const section = REQUESTABLE_SECTIONS[href as keyof typeof REQUESTABLE_SECTIONS];
  return {
    href: COUNTRY_UNAVAILABLE_PATH,
    badge: "Presto",
    hint: "Non ancora disponibile nel tuo paese",
    onOpen: section && (country === "DE" || country === "OTHER") ? () => track("country_feature_requested", { section, country }) : undefined,
  };
}

/**
 * Navigation items with the sections that depend on another country's rules marked as locked instead of removed, so
 * the user sees they exist and are coming. Other gates can lock more items on the result; an item already locked
 * keeps its first lock.
 */
export function withCountryLocks(items: NavItem[], country: string): NavItem[] {
  return items.map((item) => (item.locked || item.comingSoon || isCountryPathAvailable(country, item.href) ? item : { ...item, locked: countryLock(country, item.href) }));
}
