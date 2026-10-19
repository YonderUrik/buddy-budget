import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { TOOLS, TOOLS_PAGE } from "@/content/tools";
import { RulesNote } from "@/components/by-rules";
import { RULES_NOTES } from "@/content/rules-needs";
import { pageMetadata } from "@/lib/page-metadata";
import { needsAttr } from "@/lib/visitor-country";

export const metadata: Metadata = pageMetadata("it", {
  title: TOOLS_PAGE.title,
  description: TOOLS_PAGE.description,
  alternates: languageAlternates(CONTENT_PATHS.strumenti, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

/** List of the free calculators: one card per tool, in the same style as the links of the other pages. */
export default function Page() {
  return (
    <ContentPage title={TOOLS_PAGE.h1} lead={TOOLS_PAGE.lead} current={CONTENT_PATHS.strumenti} crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Calcolatori" }]} ctaTitle="Nell'app i numeri sono i tuoi." ctaText="Zainetto, rate e risparmio si calcolano dalle tue operazioni e dai tuoi movimenti, senza riscrivere niente." ctaLocation="strumenti">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: TOOLS_PAGE.h1, url: `${SITE_URL}${CONTENT_PATHS.strumenti}`, inLanguage: "it-IT", description: TOOLS_PAGE.description, isPartOf: { "@id": `${SITE_URL}/#website` }, hasPart: TOOLS.map((t) => ({ "@type": "WebPage", name: t.name, url: `${SITE_URL}${t.href}` })) }} />
      <div className="related">
        {TOOLS.map((t) => (
          <Link key={t.id} href={t.href} data-needs={needsAttr(t.needs)}>{t.name}<span>{t.text}</span></Link>
        ))}
      </div>
      <RulesNote text={RULES_NOTES.it.taxes} />
      <h2 data-needs="taxes">Vuoi capire la logica?</h2>
      <div className="related" data-needs="taxes">
        <Link href={CONTENT_PATHS.guidaZainetto}>Guida allo zainetto fiscale<span>Cos&apos;è, come funzionano i quattro anni, con esempi e fonti.</span></Link>
        <Link href={CONTENT_PATHS.funzioneInvestimenti}>Investimenti con le tasse italiane<span>Come BuddyBudget calcola rendimento, zainetto e bollo.</span></Link>
      </div>
    </ContentPage>
  );
}
