import { localizedMetadata } from "@/lib/localization/metadata";
import { t as trLanding } from "@/lib/localization";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { ScreenGallery } from "@/components/screen-gallery";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Le schermate di BuddyBudget: conti, investimenti, pensione e debiti";
const DESCRIPTION = "Tutte le schermate dell'app, area per area. Sono screenshot dell'app vera con dati di esempio inventati.";

export const metadata: Metadata = localizedMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.schermate },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
}, "/schermate");

export default function Page() {
  return (
    <ContentPage current={CONTENT_PATHS.schermate}
      wide
      disclaimer={false}
      crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Schermate" }]}
      ctaTitle={trLanding("Vedile con i tuoi numeri.")}
      ctaText={trLanding("Accedi con un link via email o con Google e collega i tuoi conti: nessuna password da ricordare.")}
      ctaLocation="schermate"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.schermate}`, inLanguage: "it-IT" }} />
      <h1>{trLanding("Le schermate dell'app")}</h1>
      <p className="lead">{trLanding("Screenshot dell'app vera, con i dati di una persona inventata. Scegli un'area e una schermata.")}</p>
      <ScreenGallery />
    </ContentPage>
  );
}
