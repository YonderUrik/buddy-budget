import type { Metadata } from "next";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_PATHS } from "@/content/legal";
import { PRIVACY_EN } from "@/content/en/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

const META = {
  // «Privacy policy · BuddyBudget» is 28 characters: too short to say what the page is in search results.
  title: "BuddyBudget privacy policy: your data and your rights",
  description: PRIVACY_EN.description,
};

export const metadata: Metadata = pageMetadata("en", { ...META, alternates: languageAlternates(EN_PATHS.privacy, "en") });

/** English translation of the privacy policy (`/en/privacy`); texts in `content/en/legal.ts`. */
export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.privacy, ...META })} />
      <LegalPage doc={PRIVACY_EN} locale="en" alternate={LEGAL_PATHS.privacy} />
    </>
  );
}
