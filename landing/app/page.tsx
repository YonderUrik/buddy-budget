import { BeforeAfterSections } from "@/components/before-after";
import { CatalogSheet } from "@/components/catalog-sheet";
import { Closing } from "@/components/closing";
import { Compare } from "@/components/compare";
import { Details } from "@/components/details";
import { Faq } from "@/components/faq";
import { Fit } from "@/components/fit";
import { ItalyRules } from "@/components/italy-rules";
import { JsonLd } from "@/components/json-ld";
import { OpenSource } from "@/components/open-source";
import { Security } from "@/components/security";
import { SheetHero } from "@/components/sheet-hero";
import { SheetTabs, type SheetTab } from "@/components/sheet-tabs";
import { SiteNav } from "@/components/site-nav";
import { SupportedSources } from "@/components/supported-sources";
import { BEFORE_AFTER } from "@/content/sheet";
import { FAQ, SITE_URL } from "@/content/site";

/** Dati strutturati FAQ: le stesse domande della sezione visibile, solo in questa pagina. */
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: FAQ.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
};

/** Schede del foglio sotto l'apertura: una per sezione, nell'ordine della pagina. */
const PAGE_TABS: readonly SheetTab[] = [
  ...BEFORE_AFTER.map((b) => ({ id: b.id, label: b.tab })),
  { id: "dettagli", label: "Dettagli" },
  { id: "italia", label: "Regole" },
  { id: "funzioni", label: "Funzioni" },
  { id: "confronto", label: "Confronto" },
  { id: "sicurezza", label: "Sicurezza" },
  { id: "domande", label: "Domande" },
];

/**
 * Home «Il foglio»: si parte dal foglio dei conti tenuto a mano e si mostra, area per area, cosa fa l'app al suo posto;
 * poi i dettagli tecnici, le regole italiane, il catalogo, il confronto, la fiducia e le domande frequenti.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <SiteNav />
      <main className="paper">
        <SheetHero />
        <SheetTabs tabs={PAGE_TABS} />
        <SupportedSources />
        <BeforeAfterSections />
        <Details />
        <ItalyRules />
        <CatalogSheet />
        <Compare />
        <Security />
        <OpenSource />
        <Fit />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
