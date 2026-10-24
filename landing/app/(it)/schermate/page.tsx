import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { ScreenGallery } from "@/components/screen-gallery";
import { languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { pageMetadata } from "@/lib/page-metadata";

const TITLE = "Schermate di BuddyBudget: conti, investimenti, debiti";
const DESCRIPTION = "Tutte le schermate dell'app, area per area: conti, movimenti, investimenti, pensione e debiti. Sono screenshot dell'app vera, con dati di esempio inventati.";

export const metadata: Metadata = pageMetadata("it", {
  title: TITLE,
  description: DESCRIPTION,
  alternates: languageAlternates(CONTENT_PATHS.schermate, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

export default function Page() {
  return (
    <ContentPage title={<>Le schermate dell&apos;app</>} lead={<>Screenshot dell&apos;app vera. Scegli un&apos;area e una schermata.</>} current={CONTENT_PATHS.schermate}
      wide
      disclaimer={false}
      crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Schermate" }]}
      ctaTitle="Vedile con i tuoi numeri."
      ctaText="Accedi con un link via email o con Google e collega i tuoi conti: nessuna password da ricordare."
      ctaLocation="schermate"
    >
      <JsonLd data={pageJsonLd({ locale: "it", path: CONTENT_PATHS.schermate, title: TITLE, description: DESCRIPTION })} />
      <ScreenGallery phoneOnMobile />
    </ContentPage>
  );
}
