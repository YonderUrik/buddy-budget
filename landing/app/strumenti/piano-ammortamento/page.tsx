import { localizedMetadata } from "@/lib/localization/metadata";
import { t as trLanding, PROFILE } from "@/lib/localization";
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

export const metadata: Metadata = localizedMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.ammortamento },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
}, "/strumenti/piano-ammortamento");

export default function Page() {
  return (
    <ContentPage kicker={trLanding("Calcolatore gratuito, senza account")} crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Calcolatori" }, { label: "Piano di ammortamento" }]} ctaTitle={trLanding("I tuoi debiti in un posto solo.")} ctaText={trLanding("BuddyBudget calcola il TAEG e confronta estinzione anticipata e surroga, con interessi risparmiati, penale e costi. Il debito entra nel patrimonio netto.")} ctaLocation="calcolatore_ammortamento">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: "Calcolatore piano di ammortamento", url: `${SITE_URL}${CONTENT_PATHS.ammortamento}`, inLanguage: "it-IT", description: DESCRIPTION, isPartOf: { "@id": `${SITE_URL}/#website` } }} />
      <h1>{trLanding("Calcolatore del piano di ammortamento")}</h1>
      <p className="lead">{trLanding("Importo, tasso e durata: ottieni la rata, quanto paghi di interessi e il piano completo, mese per mese. Poi prova a estinguere una parte del capitale.")}</p>
      <AmmortamentoCalculator />
      <p className="note">{trLanding("Piano alla francese a rata costante, con TAN e rate mensili. Non include spese di istruttoria, assicurazioni o tassi variabili: per il costo reale serve il TAEG del contratto.")}</p>
      <h2>{trLanding("Rata costante, interessi decrescenti")}</h2>
      <p>{trLanding("Nel piano alla francese la rata resta uguale, ma all'inizio quasi tutta serve a pagare interessi; col tempo cresce la quota di capitale. Per questo estinguere una parte presto fa risparmiare più che farlo verso la fine.")}</p>
      <h2>{trLanding("Altri strumenti")}</h2>
      <div className="related">
        {PROFILE.country === "DE" && <Link href={CONTENT_PATHS.obiettivo}>{trLanding("Obiettivo di risparmio")}</Link>}
        {PROFILE.country === "IT" && <Link href={CONTENT_PATHS.zainetto}>{trLanding("Zainetto fiscale")}<span>{trLanding("Minusvalenze, scadenze e imposta su una plusvalenza.")}</span></Link>}
        {PROFILE.country === "IT" && <Link href={CONTENT_PATHS.funzioneInvestimenti}>{trLanding("Investimenti con le tasse italiane")}<span>{trLanding("Come BuddyBudget calcola rendimento, zaino fiscale e bollo.")}</span></Link>}
      </div>
      <Sources items={[SOURCES.guidaMutuo, SOURCES.prestitoPersonale]} />
    </ContentPage>
  );
}
