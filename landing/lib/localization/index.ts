import { GERMAN_COPY } from "./country-copy";
import en from "./en.json";
import de from "./de.json";
import { resolveProfile } from "./profiles";
/** Immutable build profile: each public URL is rendered in its own language, including without JavaScript. */
export const PROFILE = resolveProfile(process.env.NEXT_PUBLIC_LANDING_COUNTRY ?? "IT", process.env.NEXT_PUBLIC_LANDING_LANGUAGE ?? "it");
export const BASE_PATH = process.env.NEXT_PUBLIC_LANDING_BASE_PATH ?? "";
export const LOCALE = { it: "it-IT", en: "en-GB", de: "de-DE" }[PROFILE.language];
const catalogs: Record<string, Record<string, string>> = { en, de };
/** Only presentation strings are translated; React nodes and user-controlled values keep their identity. */
export function t<T>(source: T): T {
  if (typeof source !== "string" || PROFILE.language === "it") return source;
  const catalog = catalogs[PROFILE.language];
  const original = source.trim();
  const trimmed = PROFILE.country === "DE" ? GERMAN_COPY[original] ?? original : original;
  const translated = catalog[trimmed];
  return (translated ? source.replace(original, translated) : source) as T;
}
/** Recursive translation for metadata and structured data; object keys and identifiers stay stable. */
export function translatedData<T>(value: T): T {
  if (typeof value === "string") return t(value);
  if (Array.isArray(value)) return value.map(translatedData) as T;
  if (value instanceof URL || value instanceof Date) return value;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,translatedData(v)])) as T;
  return value;
}
export function localPath(path: string): string { return path.startsWith("/") && !path.startsWith("//") ? BASE_PATH + path : path; }
