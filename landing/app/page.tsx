import "@/components/tail/tail.css";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Story } from "@/components/story/story";
import { Closing } from "@/components/tail/closing";
import { FaqHome } from "@/components/tail/faq-home";
import { RulesHome } from "@/components/tail/rules-home";
import { SecurityHome } from "@/components/tail/security-home";
import { ToolsHome } from "@/components/tail/tools-home";
import { WorksWith } from "@/components/tail/works-with";
import { FAQ, SITE_URL } from "@/content/site";

/** Dati strutturati FAQ: le stesse domande della sezione visibile, solo in questa pagina. */
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: FAQ.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
};

/**
 * Home «Sei domande» (2026-10-14): la finestra dell'app resta ferma e risponde a sei domande mentre si scorre; poi
 * con cosa funziona, la sicurezza in chiaro con il codice aperto, le regole italiane, i calcolatori, le domande e la chiusura.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <SiteNav />
      <main>
        <Story />
        <div className="tail">
          <WorksWith />
          <SecurityHome />
          <RulesHome />
          <ToolsHome />
          <FaqHome />
        </div>
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}
