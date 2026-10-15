import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { CONTENT_PATHS } from "@/content/seo-pages";

/** Pagina 404 in italiano: dice che l'indirizzo non esiste e rimanda alle pagine principali. */
export default function NotFound() {
  return (
    <ContentPage crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Pagina non trovata" }]} ctaTitle="Crea un account per iniziare." ctaText="Accedi con un link via email o con Google. Nessuna password da ricordare." ctaLocation="funzioni" disclaimer={false}>
      <h1>Questa pagina non esiste</h1>
      <p className="lead">L&apos;indirizzo potrebbe essere sbagliato o la pagina è stata spostata. Da qui puoi andare in questi posti.</p>
      <div className="related">
        <Link href="/">Home<span>Le sei domande a cui risponde BuddyBudget.</span></Link>
        <Link href={CONTENT_PATHS.funzioni}>Funzioni<span>L&apos;elenco completo, area per area.</span></Link>
        <Link href={CONTENT_PATHS.strumenti}>Calcolatori<span>Zainetto fiscale, ammortamento, obiettivo di risparmio: senza account.</span></Link>
        <Link href={CONTENT_PATHS.sicurezza}>Sicurezza<span>Come funziona il collegamento alla banca e cosa salviamo.</span></Link>
      </div>
    </ContentPage>
  );
}
