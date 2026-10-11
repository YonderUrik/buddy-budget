import { Closing } from "@/components/closing";
import { Compare } from "@/components/compare";
import { Faq } from "@/components/faq";
import { Fit } from "@/components/fit";
import { ItalyRules } from "@/components/italy-rules";
import { JsonLd } from "@/components/json-ld";
import { OpenSource } from "@/components/open-source";
import { Security } from "@/components/security";
import { SheetHero } from "@/components/sheet-hero";
import { SiteNav } from "@/components/site-nav";
import { SupportedSources } from "@/components/supported-sources";
import { Tour } from "@/components/tour";
import { FAQ, SITE_URL } from "@/content/site";

/** Dati strutturati FAQ: le stesse domande della sezione visibile, solo in questa pagina. */
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: FAQ.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
};

/** Schede del foglio sotto l'apertura: una per sezione, nell'ordine della pagina. */
/**
 * Home «Il foglio»: si parte dal foglio dei conti tenuto a mano, poi le fonti supportate e il giro dell'app area per
 * area (schermate intere e scheda tecnica), le regole italiane, il confronto, la fiducia e le domande frequenti.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <SiteNav />
      <main>
        <SheetHero />
        <SupportedSources />
        <Tour />
        <ItalyRules />
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
