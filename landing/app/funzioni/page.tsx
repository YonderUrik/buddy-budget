import { localizedMetadata } from "@/lib/localization/metadata";
import { t as trLanding } from "@/lib/localization";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { FeatureAreas } from "@/components/feature-areas";
import { JsonLd } from "@/components/json-ld";
import { FEATURE_AREAS, featureCounts } from "@/content/country-catalog";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Tutte le funzioni di BuddyBudget: conti, investimenti, pensione e debiti";
const DESCRIPTION = "L'elenco completo di ciò che fa BuddyBudget, area per area: conti, movimenti, investimenti con le tasse italiane, debiti e patrimonio netto.";

export const metadata: Metadata = localizedMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.funzioni },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
}, "/funzioni");

export default function Page() {
  const { total } = featureCounts();
  return (
    <ContentPage current={CONTENT_PATHS.funzioni}
      wide
      disclaimer={false}
      crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Funzioni" }]}
      ctaTitle={trLanding("Provale con i tuoi dati.")}
      ctaText={trLanding("Collega la banca in sola lettura o aggiungi un conto a mano, e vedi il quadro completo in pochi minuti.")}
      ctaLocation="funzioni"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.funzioni}`, inLanguage: "it-IT" }} />
      <h1>{trLanding("Tutte le funzioni")}</h1>
      <p className="lead">{trLanding(total)}{trLanding(" funzioni in ")}{trLanding(FEATURE_AREAS.length)}{trLanding(" aree. L'elenco è lo stesso che usa l'app: quando ne aggiungiamo una, compare anche qui.")}</p>
      <FeatureAreas />
    </ContentPage>
  );
}
