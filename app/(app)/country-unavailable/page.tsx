import Link from "next/link";
import { getLocaleProfile, getTranslator } from "@/lib/localization/server";
import { COUNTRY_UNAVAILABLE_MESSAGE, COUNTRY_UNAVAILABLE_NOTES } from "@/lib/localization/config";
import { PAGE_FRAME, PAGE_READABLE, PAGE_TITLE } from "@/components/domain/shared";
import { cn } from "@/lib/utils";
/** Explain a country capability restriction for bookmarks, direct navigation and the «Presto» menu entries. */
export default async function CountryUnavailablePage() {
  const t = await getTranslator();
  const { productCountry } = await getLocaleProfile();
  const note = COUNTRY_UNAVAILABLE_NOTES[productCountry];
  return <div className={cn(PAGE_FRAME, PAGE_READABLE, "gap-4 sm:gap-4")}>
    <h1 className={PAGE_TITLE}>{t(COUNTRY_UNAVAILABLE_MESSAGE)}</h1>
    {note ? <p className="text-muted-foreground">{t(note)}</p> : null}
    <p className="text-sm text-muted-foreground">{t("Il paese si cambia in Impostazioni.")}</p>
    <div className="flex gap-4">
      <Link className="underline" href="/panoramica">{t("Panoramica")}</Link>
      <Link className="underline" href="/impostazioni">{t("Impostazioni")}</Link>
    </div>
  </div>;
}
