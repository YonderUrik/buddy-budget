import type { Metadata } from "next";
import { HomePage } from "@/components/home/home-page";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { HOME_EN, SITE_DESCRIPTION_EN, SITE_TITLE_EN } from "@/content/en/home";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: SITE_TITLE_EN,
  description: SITE_DESCRIPTION_EN,
  alternates: languageAlternates(EN_PATHS.home, "en"),
});

/** English home (`/en`); texts in `content/en/home.ts`. */
export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.home, title: SITE_TITLE_EN, description: SITE_DESCRIPTION_EN })} />
      <HomePage content={HOME_EN} />
    </>
  );
}
