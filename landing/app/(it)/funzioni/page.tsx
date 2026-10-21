import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { ByRulesText } from "@/components/by-rules";
import { FeatureAreas, featureCountByRules } from "@/components/feature-areas";
import { JsonLd } from "@/components/json-ld";
import { FEATURE_AREAS, FEATURES } from "@/content/catalog.generated";
import { languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { pageMetadata } from "@/lib/page-metadata";

const TITLE = "Tutte le funzioni di BuddyBudget: conti, investimenti, pensione e debiti";
const DESCRIPTION = "L'elenco completo di ciò che fa BuddyBudget, area per area: conti, movimenti, investimenti con le tasse italiane, debiti e patrimonio netto.";

export const metadata: Metadata = pageMetadata("it", {
  title: TITLE,
  description: DESCRIPTION,
  alternates: languageAlternates(CONTENT_PATHS.funzioni, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

export default function Page() {
  return (
    <ContentPage title="Tutte le funzioni" lead={<><ByRulesText text={featureCountByRules(FEATURES)} /> funzioni in {FEATURE_AREAS.length} aree. L&apos;elenco è lo stesso che usa l&apos;app: quando ne aggiungiamo una, compare anche qui.</>} current={CONTENT_PATHS.funzioni}
      wide
      disclaimer={false}
      crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Funzioni" }]}
      ctaTitle="Provale con i tuoi dati."
      ctaText="Importa l'estratto conto o aggiungi un conto a mano, e vedi il quadro completo in pochi minuti."
      ctaLocation="funzioni"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.funzioni}`, inLanguage: "it-IT" }} />
      <FeatureAreas />
    </ContentPage>
  );
}
