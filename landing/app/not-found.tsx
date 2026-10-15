import { t as trLanding } from "@/lib/localization";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { CONTENT_PATHS } from "@/content/seo-pages";

/** Pagina 404 in italiano: dice che l'indirizzo non esiste e rimanda alle pagine principali. */
export default function NotFound() {
  return (
    <ContentPage crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Pagina non trovata" }]} ctaTitle={trLanding("Crea un account per iniziare.")} ctaText={trLanding("Accedi con un link via email o con Google. Nessuna password da ricordare.")} ctaLocation="funzioni" disclaimer={false}>
      <h1>{trLanding("Questa pagina non esiste")}</h1>
      <p className="lead">{trLanding("L'indirizzo potrebbe essere sbagliato o la pagina è stata spostata. Da qui puoi andare in questi posti.")}</p>
      <div className="related">
        <Link href="/">{trLanding("Home")}<span>{trLanding("Le sei domande a cui risponde BuddyBudget.")}</span></Link>
        <Link href={CONTENT_PATHS.funzioni}>{trLanding("Funzioni")}<span>{trLanding("L'elenco completo, area per area.")}</span></Link>
        <Link href={CONTENT_PATHS.strumenti}>{trLanding("Calcolatori")}<span>{trLanding("Zainetto fiscale, ammortamento, obiettivo di risparmio: senza account.")}</span></Link>
        <Link href={CONTENT_PATHS.sicurezza}>{trLanding("Sicurezza")}<span>{trLanding("Come funziona il collegamento alla banca e cosa salviamo.")}</span></Link>
      </div>
    </ContentPage>
  );
}
