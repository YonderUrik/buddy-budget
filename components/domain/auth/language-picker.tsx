"use client";
import { usePathname } from "next/navigation";

import { LanguageSelect } from "@/components/domain/locale";
import { track } from "@/lib/analytics";
import { LANGUAGE_COOKIE, type Language } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";

/** Public language preference only (a cookie): the authenticated account controls product-country permissions. Hidden in onboarding, which has its own field. */
export function LanguagePicker() {
  const { language } = useLocalization();
  const pathname = usePathname();
  if (pathname === "/onboarding") return null;
  return (
    <LanguageSelect
      variant="link"
      value={language}
      onChange={(next: Language) => {
        track("language_changed", { from: "login", language: next });
        document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        window.location.reload();
      }}
    />
  );
}
