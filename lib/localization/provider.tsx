"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PROFILE, LANGUAGE_COOKIE, LANGUAGE_LOCALES, countryFeatures, type LocaleProfile } from "./config";
import { translate, type MessageValues } from "./messages";
const LocalizationContext = createContext<{ profile: LocaleProfile; setProfile: (profile: LocaleProfile) => void }>({ profile: DEFAULT_PROFILE, setProfile: () => {} });
/** Request-specific language and product country; no shared server mutable state. */
export function LocalizationProvider({ profile, children }: { profile: LocaleProfile; children: ReactNode }) {
  const [currentProfile, setProfile] = useState(profile);
  useEffect(() => {
    document.documentElement.lang = currentProfile.language;
    document.cookie = `${LANGUAGE_COOKIE}=${currentProfile.language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [currentProfile.language]);
  const value = useMemo(() => ({ profile: currentProfile, setProfile }), [currentProfile]);
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}
/** Country capabilities, number/date locale and translator for client components. */
export function useLocalization() {
  const { profile, setProfile } = useContext(LocalizationContext);
  return useMemo(() => ({ ...profile, setProfile, locale: LANGUAGE_LOCALES[profile.language], features: countryFeatures(profile.productCountry),
    t: <T,>(source: T, values?: MessageValues) => translate(profile.language, source, values),
  }), [profile, setProfile]);
}
/** Translate a static message embedded by either a server or a client component. */
export function LocalizedText({ children }: { children: string }) {
  const { t } = useLocalization();
  return t(children);
}
