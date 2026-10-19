"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pickUtm, UTM_STORAGE_KEY, withLanguage, withUtm } from "@/lib/utm";
import { storedLanguageChoice } from "@/lib/visitor-country";

/**
 * Carries the visitor's campaign parameters (`?utm_source=instagram…`) onto every link to the app, so the sign-in page
 * (and from there the signup event) knows where the visitor came from. They are kept for the session, so they hold
 * after moving to another landing page. A language chosen by hand on the landing goes along as `lang=` to the app's
 * sign-in and demo (otherwise the app picks it from the country). Renders nothing; without parameters the links keep
 * `utm_source=landing`.
 */
export function UtmPassthrough({ appUrl }: { appUrl: string }) {
  const pathname = usePathname();

  useEffect(() => {
    let utm = pickUtm(window.location.search);
    try {
      if (Object.keys(utm).length) window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
      else utm = JSON.parse(window.sessionStorage.getItem(UTM_STORAGE_KEY) ?? "{}");
    } catch {
      // Storage blocked: the parameters of this page still apply.
    }
    const lang = storedLanguageChoice();
    if (!Object.keys(utm).length && !lang) return;
    for (const a of document.querySelectorAll<HTMLAnchorElement>(`a[href^="${appUrl}/"]`)) {
      const href = Object.keys(utm).length ? withUtm(a.href, utm) : a.href;
      a.href = lang ? withLanguage(href, lang) : href;
    }
  }, [appUrl, pathname]);

  return null;
}
