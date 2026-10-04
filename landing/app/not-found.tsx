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
        <Link href="/">Home<span>Le domande a cui risponde BuddyBudget.</span></Link>
        <Link href={CONTENT_PATHS.funzioni}>Funzioni<span>L&apos;elenco completo, area per area.</span></Link>
        <Link href={CONTENT_PATHS.zainetto}>Calcolatore dello zainetto fiscale<span>Gratuito, senza account.</span></Link>
      </div>
    </ContentPage>
  );
}
