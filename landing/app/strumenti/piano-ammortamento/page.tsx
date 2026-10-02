import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { AmmortamentoCalculator } from "@/components/tools/ammortamento-calculator";
import { Sources } from "@/components/sources";
import { CONTENT_DRAFT, CONTENT_PATHS, SOURCES } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Calcolatore piano di ammortamento ed estinzione anticipata";
const DESCRIPTION = "Calcola rata, interessi totali e piano di ammortamento alla francese di un mutuo o di un finanziamento, e simula quanto risparmi estinguendo una parte in anticipo. Gratis.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.ammortamento },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return (
    <ContentPage crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Calcolatori" }, { label: "Piano di ammortamento" }]} ctaTitle="Tutti i tuoi debiti, in un solo piano." ctaText="BuddyBudget calcola il TAEG, confronta estinzione anticipata, surroga e Credit Lombard con interessi risparmiati, penale e costi, e porta il debito dentro il patrimonio netto." ctaLocation="calcolatore_ammortamento">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "Calcolatore piano di ammortamento", url: `${SITE_URL}${CONTENT_PATHS.ammortamento}`, applicationCategory: "FinanceApplication", operatingSystem: "Web", inLanguage: "it-IT", description: DESCRIPTION, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" } }} />
      <h1>Calcolatore del piano di ammortamento</h1>
      <p className="lead">Importo, tasso e durata: ottieni la rata, quanto paghi di interessi e il piano completo, mese per mese. Poi prova a estinguere una parte del capitale.</p>
      <AmmortamentoCalculator />
      <p className="note">Piano alla francese a rata costante, con TAN e rate mensili. Non include spese di istruttoria, assicurazioni o tassi variabili: per il costo reale serve il TAEG del contratto.</p>
      <h2>Rata costante, interessi decrescenti</h2>
      <p>Nel piano alla francese la rata resta uguale, ma all&apos;inizio quasi tutta serve a pagare interessi; col tempo cresce la quota di capitale. Per questo estinguere una parte presto fa risparmiare più che farlo verso la fine.</p>
      <h2>Altri strumenti</h2>
      <div className="related">
        <Link href={CONTENT_PATHS.zainetto}>Zainetto fiscale<span>Minusvalenze, scadenze e imposta su una plusvalenza.</span></Link>
        <Link href={CONTENT_PATHS.funzioneInvestimenti}>Investimenti con le tasse italiane<span>Come BuddyBudget calcola rendimento, zaino fiscale e bollo.</span></Link>
      </div>
      <Sources items={[SOURCES.guidaMutuo, SOURCES.prestitoPersonale]} />
    </ContentPage>
  );
}
