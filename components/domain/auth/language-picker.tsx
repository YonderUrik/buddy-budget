"use client";
import { LANGUAGE_COOKIE, LANGUAGE_NAMES, LANGUAGES, type Language } from "@/lib/localization/config";
import { usePathname } from "next/navigation";
import { useLocalization } from "@/lib/localization/provider";
/** Public language preference only: the authenticated account controls product-country permissions. */
export function LanguagePicker() {
  const { language, t } = useLocalization();
  const pathname = usePathname();
  if (pathname === "/onboarding") return null;
  return <label className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
    {t("Lingua")}
    <select aria-label={t("Lingua")} value={language} className="rounded-md border bg-background px-2 py-1 text-foreground" onChange={event => {
      const next = event.target.value as Language;
      document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      window.location.reload();
    }}>{LANGUAGES.map(value => <option key={value} value={value}>{LANGUAGE_NAMES[value]}</option>)}</select>
  </label>;
}
