import { Closing } from "@/components/closing";
import { DeepLinks } from "@/components/deep-links";
import { Faq } from "@/components/faq";
import { Fit } from "@/components/fit";
import { JsonLd } from "@/components/json-ld";
import { Security } from "@/components/security";
import { SheetHero } from "@/components/sheet-hero";
import { SiteNav } from "@/components/site-nav";
import { SupportedSources } from "@/components/supported-sources";
import { Tour } from "@/components/tour";
import { HOME_FAQ, SITE_URL } from "@/content/site";

/** Dati strutturati FAQ: le stesse domande della sezione visibile, solo in questa pagina. */
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: HOME_FAQ.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
};

/** Schede del foglio sotto l'apertura: una per sezione, nell'ordine della pagina. */
/**
 * Home corta: apertura, fonti supportate, giro dell'app, per chi è, sicurezza in breve, rimandi agli approfondimenti
 * (funzioni, calcolatori, tasse italiane con il confronto, sicurezza) e poche domande frequenti.
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
        <Fit />
        <Security />
        <DeepLinks />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
