import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { languageAlternates } from "@/content/locales";
import { ObiettivoCalculator } from "@/components/tools/obiettivo-calculator";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { OBIETTIVO_PAGE } from "@/content/tools";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("it", {
  title: OBIETTIVO_PAGE.title,
  description: OBIETTIVO_PAGE.description,
  alternates: languageAlternates(CONTENT_PATHS.obiettivo, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

export default function Page() {
  return (
    <ContentPage title={OBIETTIVO_PAGE.h1} current={CONTENT_PATHS.obiettivo} lead={OBIETTIVO_PAGE.lead} crumbs={[{ href: "/", label: "BuddyBudget" }, { href: CONTENT_PATHS.strumenti, label: "Calcolatori" }, { label: "Obiettivo di risparmio" }]} ctaTitle="I tuoi obiettivi, con i soldi veri." ctaText="In BuddyBudget quanto metti da parte ogni mese si legge dai conti collegati. Crei un obiettivo, scegli da quali conti o investimenti arrivano i soldi e vedi quando ci arrivi, se il risparmio basta per tutti gli obiettivi e di quanto ognuno sposta l'anno in cui puoi smettere di lavorare." ctaLocation="calcolatore_obiettivo">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: OBIETTIVO_PAGE.h1, url: `${SITE_URL}${CONTENT_PATHS.obiettivo}`, inLanguage: "it-IT", description: OBIETTIVO_PAGE.description, isPartOf: { "@id": `${SITE_URL}/#website` } }} />
      <ObiettivoCalculator />
      <p className="note">Stima semplificata: versamenti uguali a fine mese, rendimento costante capitalizzato ogni mese, senza tasse sul rendimento né inflazione. Un conto deposito o un fondo rendono in modo diverso da così.</p>
      <h2>Come funziona il calcolo</h2>
      <ul>
        <li>Senza rendimento, i mesi sono la differenza tra obiettivo e quello che hai, divisa per il versamento mensile.</li>
        <li>Con un rendimento, ogni mese il capitale cresce del tasso mensile (il rendimento annuo diviso dodici) e si aggiunge il versamento: è il montante di una rendita.</li>
        <li>Il mese di arrivo è quello in cui il valore supera l&apos;obiettivo per la prima volta.</li>
        <li>Il rendimento qui è lordo: sui guadagni di un conto deposito o di un investimento si pagano le imposte (26%, 12,5% per i titoli di Stato).</li>
      </ul>
      <h2>Altri strumenti</h2>
      <div className="related">
        <Link href={CONTENT_PATHS.zainetto}>Zainetto fiscale<span>Minusvalenze, scadenze e imposta su una plusvalenza.</span></Link>
        <Link href={CONTENT_PATHS.ammortamento}>Piano di ammortamento<span>Rata, interessi ed estinzione anticipata di un finanziamento.</span></Link>
      </div>
    </ContentPage>
  );
}
