import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { FeatureCatalog } from "@/components/feature-catalog";
import { JsonLd } from "@/components/json-ld";
import { featureCounts } from "@/content/catalog.generated";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Tutte le funzioni di BuddyBudget: conti, investimenti, pensione e debiti";
const DESCRIPTION = "L'elenco completo di ciò che fa BuddyBudget, area per area: conti, movimenti, investimenti con le tasse italiane, debiti e patrimonio netto.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.funzioni },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  const { total } = featureCounts();
  return (
    <ContentPage
      wide
      disclaimer={false}
      crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Funzioni" }]}
      ctaTitle="Provale con i tuoi dati."
      ctaText="Collega la banca in sola lettura o aggiungi un conto a mano, e vedi il quadro completo in pochi minuti."
      ctaLocation="funzioni"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.funzioni}`, inLanguage: "it-IT" }} />
      <h1>Tutte le funzioni</h1>
      <p className="lead">{total} funzioni, divise per area. L&apos;elenco è lo stesso che usa l&apos;app: quando ne aggiungiamo una, compare qui.</p>
      <FeatureCatalog />
    </ContentPage>
  );
}
