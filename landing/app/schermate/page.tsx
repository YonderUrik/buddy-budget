import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { ScreenGallery } from "@/components/screen-gallery";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Le schermate di BuddyBudget: conti, investimenti, pensione e debiti";
const DESCRIPTION = "Tutte le schermate dell'app, area per area. Sono screenshot dell'app vera con dati di esempio inventati.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.schermate },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return (
    <ContentPage
      wide
      disclaimer={false}
      crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Schermate" }]}
      ctaTitle="Vedile con i tuoi numeri."
      ctaText="Accedi con un link via email o con Google e collega i tuoi conti: nessuna password da ricordare."
      ctaLocation="schermate"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.schermate}`, inLanguage: "it-IT" }} />
      <h1>Tutto quello che vedi è l&apos;app</h1>
      <p className="lead">Niente mockup: sono screenshot dell&apos;app vera, con dati di esempio inventati. Scegli una schermata.</p>
      <ScreenGallery />
    </ContentPage>
  );
}
