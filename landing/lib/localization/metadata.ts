import type { Metadata } from "next";
import { BASE_PATH, LOCALE, PROFILE, translatedData } from "./index";
import { PROFILES, availablePage } from "./profiles";
/** Canonicals and alternates name only valid country/language combinations for this page. */
export function localizedMetadata(metadata: Metadata, path: string): Metadata {
  const translated = translatedData(metadata);
  const languages = Object.fromEntries(PROFILES.filter(p => availablePage(p.country,path)).map(p => [`${p.language}-${p.country}`, `${p.path}${path}`]));
  return { ...translated, alternates: { canonical: `${BASE_PATH}${path}`, languages: { ...languages, "x-default": path } },
    openGraph: { ...translated.openGraph, locale: LOCALE.replace("-","_"), url: `${BASE_PATH}${path}` },
    ...(!availablePage(PROFILE.country,path) ? { robots: { index: false, follow: true } } : {}) };
}
/** Translate schema text and adjust internal URLs without changing external sources or legal identifiers. */
export function localizedSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(localizedSchema);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, k === "inLanguage" ? LOCALE : localizedSchema(v)]));
  if (typeof value !== "string") return value;
  const origin=(process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io").replace(/\/$/, "");
  if(BASE_PATH && (value===origin || value.startsWith(origin+"/"))) return origin+BASE_PATH+value.slice(origin.length);
  return translatedData(value);
}
