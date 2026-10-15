/** Product rules and display language are independent, just as in the app. */
export const PROFILES = [
  { country: "IT", language: "it", path: "/it/it" },
  { country: "IT", language: "en", path: "/it/en" },
  { country: "DE", language: "de", path: "/de/de" },
  { country: "DE", language: "en", path: "/de/en" },
] as const;
export type Profile = (typeof PROFILES)[number];
export const PREFERENCE_KEY = "bb-landing-profile-v1";
export function resolveProfile(country: string, language: string): Profile {
  return PROFILES.find(p => p.country === country && p.language === language)
    ?? PROFILES.find(p => p.country === country && p.language === "en") ?? PROFILES[1];
}
/** Browser regional preferences are a suggestion, not a geolocation or tax-residency determination. */
export function detectProfile(languages: readonly string[]): Profile {
  const tags = languages.map(s => { try { return new Intl.Locale(s); } catch { return null; } }).filter(s => s !== null);
  const regional = tags.find(s => s.region === "IT" || s.region === "DE");
  const country = regional?.region ?? (tags[0]?.language === "de" ? "DE" : "IT");
  const language = tags.find(s => s.language === "en" || (country === "IT" ? s.language === "it" : s.language === "de"))?.language ?? "en";
  return resolveProfile(country, language);
}
/** A selected profile keeps its path; automatic detection only runs on legacy, unprefixed entry URLs. */
export function profileFromPath(path: string): Profile | undefined {
  return PROFILES.find(p => path === p.path || path.startsWith(p.path + "/"));
}
export function pagePath(path: string): string {
  const profile = profileFromPath(path);
  return profile ? path.slice(profile.path.length) || "/" : path;
}
export function availablePage(country: string, path: string): boolean {
  return country !== "DE" || !["/strumenti/zainetto-fiscale", "/guide/zainetto-fiscale", "/funzioni/investimenti"].includes(path.replace(/\/$/, ""));
}
