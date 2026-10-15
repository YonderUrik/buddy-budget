"use client";
import { useEffect } from "react";
import { BASE_PATH, PROFILE, t } from "@/lib/localization";
import { PROFILES, PREFERENCE_KEY, availablePage, detectProfile, pagePath, profileFromPath, resolveProfile, type Profile } from "@/lib/localization/profiles";

function savedProfile(): Profile | undefined {
  try { const value = JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? "null"); return PROFILES.find(p => p.country === value?.country && p.language === value?.language); } catch { return undefined; }
}
/** Explicit choices override browser preferences. A shared localized URL always retains its own profile. */
export function LocaleSelector() {
  useEffect(() => {
    const saved = savedProfile();
    if (!BASE_PATH && !profileFromPath(location.pathname)) {
      const profile = saved ?? detectProfile(navigator.languages ?? [navigator.language]);
      const path = availablePage(profile.country, location.pathname) ? location.pathname : "/";
      location.replace(profile.path + path + location.search + location.hash);
    }
  }, []);
  function select(profile: Profile, remember = true) {
    try { if (remember) localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ country: profile.country, language: profile.language })); else localStorage.removeItem(PREFERENCE_KEY); } catch { /* Selection still works when browser storage is unavailable. */ }
    const page = pagePath(location.pathname);
    location.assign(profile.path + (availablePage(profile.country, page) ? page : "/") + location.search + location.hash);
  }
  return <div className="locale-selector" role="group" aria-label={t("Paese e lingua")}>
    <label><span>{t("Paese")}</span><select aria-label={t("Paese")} value={PROFILE.country} onChange={e => select(resolveProfile(e.target.value, PROFILE.language))}>
      <option value="IT">{t("Italia")}</option><option value="DE">{t("Germania")}</option>
    </select></label>
    <label><span>{t("Lingua")}</span><select aria-label={t("Lingua")} value={PROFILE.language} onChange={e => select(resolveProfile(PROFILE.country, e.target.value))}>
      {PROFILES.filter(p => p.country === PROFILE.country).map(p => <option key={p.language} value={p.language}>{{ it: "Italiano", en: "English", de: "Deutsch" }[p.language]}</option>)}
    </select></label>
    <button type="button" onClick={() => select(detectProfile(navigator.languages ?? [navigator.language]), false)} title={t("Usa le preferenze del browser")}>{t("Rileva")}</button>
  </div>;
}
