import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { languageAlternates } from "@/content/locales";
import { AmmortamentoCalculator } from "@/components/tools/ammortamento-calculator";
import { Sources } from "@/components/sources";
import { CONTENT_DRAFT, CONTENT_PATHS, SOURCES } from "@/content/seo-pages";
import { pageMetadata } from "@/lib/page-metadata";

const TITLE = "Calcolatore piano di ammortamento ed estinzione anticipata";
const DESCRIPTION = "Calcola rata, interessi totali e piano di ammortamento alla francese di un mutuo o prestito, e quanto risparmi estinguendo una parte in anticipo.";

export const metadata: Metadata = pageMetadata("it", {
  title: TITLE,
  description: DESCRIPTION,
  alternates: languageAlternates(CONTENT_PATHS.ammortamento, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

export default function Page() {
  return (
    <ContentPage title="Calcolatore del piano di ammortamento" current={CONTENT_PATHS.ammortamento} lead="Importo, tasso e durata: ottieni la rata, quanto paghi di interessi e il piano completo, mese per mese. Poi prova a estinguere una parte del capitale." crumbs={[{ href: "/", label: "BuddyBudget" }, { href: CONTENT_PATHS.strumenti, label: "Calcolatori" }, { label: "Piano di ammortamento" }]} ctaTitle="I tuoi debiti in un posto solo." ctaText="BuddyBudget calcola il TAEG e confronta estinzione anticipata e surroga, con interessi risparmiati, penale e costi. Il debito entra nel patrimonio netto." ctaLocation="calcolatore_ammortamento">
      <JsonLd data={pageJsonLd({ locale: "it", path: CONTENT_PATHS.ammortamento, title: TITLE, description: DESCRIPTION })} />
      <AmmortamentoCalculator />
      <p className="note">Piano alla francese a rata costante, con TAN e rate mensili. Non include spese di istruttoria, assicurazioni o tassi variabili: per il costo reale serve il TAEG del contratto.</p>
      <h2>Rata costante, interessi decrescenti</h2>
      <p>Nel piano alla francese la rata resta uguale, ma all&apos;inizio quasi tutta serve a pagare interessi; col tempo cresce la quota di capitale. Per questo estinguere una parte presto fa risparmiare più che farlo verso la fine.</p>
      <h2 data-needs="taxes">Altri strumenti</h2>
      <div className="related" data-needs="taxes">
        <Link href={CONTENT_PATHS.zainetto}>Zainetto fiscale<span>Minusvalenze, scadenze e imposta su una plusvalenza.</span></Link>
        <Link href={CONTENT_PATHS.funzioneInvestimenti}>Investimenti con le tasse italiane<span>Come BuddyBudget calcola rendimento, zaino fiscale e bollo.</span></Link>
      </div>
      <Sources items={[SOURCES.guidaMutuo, SOURCES.prestitoPersonale]} />
    </ContentPage>
  );
}
