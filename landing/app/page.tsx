import "@/components/home/home.css";
import { Closing } from "@/components/home/closing";
import { Faq } from "@/components/home/faq";
import { Hero } from "@/components/home/hero";
import { MobileCta } from "@/components/home/mobile-cta";
import { Showcase } from "@/components/home/showcase";
import { Sources } from "@/components/home/sources";
import { Trust } from "@/components/home/trust";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { CLOSE } from "@/content/home";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { FAQ, SITE_URL } from "@/content/site";

/** Structured FAQ data: the same questions as the visible section, only on this page. */
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: FAQ.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
};

/** Label of the sign-in button in the phone bar. */
const LOGIN_LABEL = "Entra";

/**
 * «Un numero solo» home (2026-10-17): the sum in the opening, the four places money comes from, what the number
 * tells you every day (five real screens), why to trust it (facts, limits, open code), the questions, the closing.
 * On the phone a fixed bar carries the button between the opening and the closing.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <SiteNav />
      <main className="home">
        <Hero />
        <Sources />
        <Showcase />
        <Trust />
        <Faq />
        <Closing title={CLOSE.title} cta={CLOSE.cta} ctaLocation="closing" secondary={{ href: CONTENT_PATHS.strumenti, label: CLOSE.tools, target: "calculator" }} />
      </main>
      <MobileCta label={CLOSE.cta} login={LOGIN_LABEL} />
      <SiteFooter />
    </>
  );
}
