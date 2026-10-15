import { localizedMetadata } from "@/lib/localization/metadata";
import { t as trLanding, PROFILE } from "@/lib/localization";
import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { TOOLS, TOOLS_PAGE } from "@/content/tools";

export const metadata: Metadata = localizedMetadata({
  title: TOOLS_PAGE.title,
  description: TOOLS_PAGE.description,
  alternates: { canonical: CONTENT_PATHS.strumenti },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
}, "/strumenti");

/** Elenco dei calcolatori gratuiti: una scheda per strumento, nello stesso stile dei rimandi delle altre pagine. */
export default function Page() {
  return (
    <ContentPage kicker={trLanding("Senza account")} current={CONTENT_PATHS.strumenti} crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Calcolatori" }]} ctaTitle={trLanding("Nell'app i numeri sono i tuoi.")} ctaText={trLanding("Zainetto, rate e risparmio si calcolano dalle tue operazioni e dai tuoi movimenti, senza riscrivere niente.")} ctaLocation="strumenti">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: TOOLS_PAGE.h1, url: `${SITE_URL}${CONTENT_PATHS.strumenti}`, inLanguage: "it-IT", description: TOOLS_PAGE.description, isPartOf: { "@id": `${SITE_URL}/#website` }, hasPart: TOOLS.map((t) => ({ "@type": "WebPage", name: t.name, url: `${SITE_URL}${t.href}` })) }} />
      <h1>{trLanding(TOOLS_PAGE.h1)}</h1>
      <p className="lead">{trLanding(TOOLS_PAGE.lead)}</p>
      <div className="related">
        {TOOLS.map((t) => (
          <Link key={t.id} href={t.href}>{trLanding(t.name)}<span>{trLanding(t.text)}</span></Link>
        ))}
      </div>
      {PROFILE.country === "IT" && <h2>{trLanding("Vuoi capire la logica?")}</h2>}
      <div className="related">
        {PROFILE.country === "IT" && <Link href={CONTENT_PATHS.guidaZainetto}>{trLanding("Guida allo zainetto fiscale")}<span>{trLanding("Cos'è, come funzionano i quattro anni, con esempi e fonti.")}</span></Link>}
        {PROFILE.country === "IT" && <Link href={CONTENT_PATHS.funzioneInvestimenti}>{trLanding("Investimenti con le tasse italiane")}<span>{trLanding("Come BuddyBudget calcola rendimento, zainetto e bollo.")}</span></Link>}
      </div>
    </ContentPage>
  );
}
