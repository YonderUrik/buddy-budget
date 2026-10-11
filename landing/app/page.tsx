import { Answers } from "@/components/answers";
import { Closing } from "@/components/closing";
import { Compare } from "@/components/compare";
import { Faq } from "@/components/faq";
import { FeaturesSection } from "@/components/features-section";
import { Fit } from "@/components/fit";
import { Groups } from "@/components/groups";
import { Hero } from "@/components/hero";
import { JsonLd } from "@/components/json-ld";
import { ItalyRules } from "@/components/italy-rules";
import { OpenSource } from "@/components/open-source";
import { Security } from "@/components/security";
import { SiteNav } from "@/components/site-nav";
import { Steps } from "@/components/steps";
import { FAQ, SITE_URL } from "@/content/site";

/** Dati strutturati FAQ: le stesse domande della sezione visibile, solo in questa pagina. */
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: FAQ.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
};

/** Home: cosa fa e come si parte, le domande con le risposte vere, il vantaggio italiano, il metodo, fiducia e confronto. */
export default function HomePage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <SiteNav />
      <main>
        <Hero />
        <Steps />
        <Answers />
        <ItalyRules />
        <Groups />
        <FeaturesSection />
        <Security />
        <OpenSource />
        <Fit />
        <Compare />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
