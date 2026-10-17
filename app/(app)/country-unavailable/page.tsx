import Link from "next/link";
import { getTranslator } from "@/lib/localization/server";
import { PAGE_TITLE } from "@/components/domain/shared";
/** Explain a country capability restriction for bookmarks and direct navigation. */
export default async function CountryUnavailablePage() {
  const t = await getTranslator();
  return <div className="mx-auto max-w-2xl space-y-4 p-6">
    <h1 className={PAGE_TITLE}>{t("Questa funzione non è ancora disponibile per la Germania.")}</h1>
    <p className="text-muted-foreground">{t("Per la Germania, tasse, pensione, previsioni dei dividendi e pianificazione del pensionamento non sono ancora disponibili. I dati esistenti vengono conservati.")}</p>
    <Link className="underline" href="/panoramica">{t("Panoramica")}</Link>
  </div>;
}
