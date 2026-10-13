import type { Metadata } from "next";
import { Closing } from "@/components/closing";
import { Compare } from "@/components/compare";
import { ItalyRules } from "@/components/italy-rules";
import { JsonLd } from "@/components/json-ld";
import { SiteNav } from "@/components/site-nav";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Tasse italiane già nei conti: zainetto, aliquote, bollo e TFR";
const DESCRIPTION = "Le regole fiscali italiane che BuddyBudget applica da sola, con le fonti ufficiali, e il confronto con un foglio di calcolo e con un'app di sole spese.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.tasse },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

/** Approfondimento spostato dalla home: la tabella delle regole italiane (con le fonti) e il confronto con le alternative. */
export default function Page() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.tasse}`, inLanguage: "it-IT" }} />
      <SiteNav current={CONTENT_PATHS.tasse} />
      <main className="page-tasse">
        <ItalyRules titleAs="h1" />
        <Compare />
        <Closing />
      </main>
    </>
  );
}
