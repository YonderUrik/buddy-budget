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
    <ContentPage title={<>Le schermate dell&apos;app</>} lead={<>Screenshot dell&apos;app vera, con i dati di una persona inventata. Scegli un&apos;area e una schermata.</>} current={CONTENT_PATHS.schermate}
      wide
      disclaimer={false}
      crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Schermate" }]}
      ctaTitle="Vedile con i tuoi numeri."
      ctaText="Accedi con un link via email o con Google e collega i tuoi conti: nessuna password da ricordare."
      ctaLocation="schermate"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.schermate}`, inLanguage: "it-IT" }} />
      <ScreenGallery phoneOnMobile />
    </ContentPage>
  );
}
