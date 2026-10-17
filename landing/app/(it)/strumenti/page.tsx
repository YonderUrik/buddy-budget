import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { TOOLS, TOOLS_PAGE } from "@/content/tools";

export const metadata: Metadata = {
  title: TOOLS_PAGE.title,
  description: TOOLS_PAGE.description,
  alternates: { canonical: CONTENT_PATHS.strumenti },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

/** Elenco dei calcolatori gratuiti: una scheda per strumento, nello stesso stile dei rimandi delle altre pagine. */
export default function Page() {
  return (
    <ContentPage title={TOOLS_PAGE.h1} lead={TOOLS_PAGE.lead} current={CONTENT_PATHS.strumenti} crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Calcolatori" }]} ctaTitle="Nell'app i numeri sono i tuoi." ctaText="Zainetto, rate e risparmio si calcolano dalle tue operazioni e dai tuoi movimenti, senza riscrivere niente." ctaLocation="strumenti">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: TOOLS_PAGE.h1, url: `${SITE_URL}${CONTENT_PATHS.strumenti}`, inLanguage: "it-IT", description: TOOLS_PAGE.description, isPartOf: { "@id": `${SITE_URL}/#website` }, hasPart: TOOLS.map((t) => ({ "@type": "WebPage", name: t.name, url: `${SITE_URL}${t.href}` })) }} />
      <div className="related">
        {TOOLS.map((t) => (
          <Link key={t.id} href={t.href}>{t.name}<span>{t.text}</span></Link>
        ))}
      </div>
      <h2>Vuoi capire la logica?</h2>
      <div className="related">
        <Link href={CONTENT_PATHS.guidaZainetto}>Guida allo zainetto fiscale<span>Cos&apos;è, come funzionano i quattro anni, con esempi e fonti.</span></Link>
        <Link href={CONTENT_PATHS.funzioneInvestimenti}>Investimenti con le tasse italiane<span>Come BuddyBudget calcola rendimento, zainetto e bollo.</span></Link>
      </div>
    </ContentPage>
  );
}
