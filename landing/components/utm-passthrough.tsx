"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pickUtm, UTM_STORAGE_KEY, withUtm } from "@/lib/utm";

/**
 * Carries the visitor's campaign parameters (`?utm_source=instagram…`) onto every link to the app, so the sign-in page
 * (and from there the signup event) knows where the visitor came from. They are kept for the session, so they hold
 * after moving to another landing page. Renders nothing; without parameters the links keep `utm_source=landing`.
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
    if (!Object.keys(utm).length) return;
    for (const a of document.querySelectorAll<HTMLAnchorElement>(`a[href^="${appUrl}/"]`)) {
      a.href = withUtm(a.href, utm);
    }
  }, [appUrl, pathname]);

  return null;
}
