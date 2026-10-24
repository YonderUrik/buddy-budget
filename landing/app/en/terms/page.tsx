import type { Metadata } from "next";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_PATHS } from "@/content/legal";
import { TERMS_EN } from "@/content/en/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

const META = {
  title: `${TERMS_EN.title} · BuddyBudget`,
  // Longer than the lead on the page: search results show 110-160 characters.
  description: "The rules for using BuddyBudget: what the service is and is not, what we ask of you, our liability, the open-source license and how an account is closed.",
};

export const metadata: Metadata = pageMetadata("en", { ...META, alternates: languageAlternates(EN_PATHS.terms, "en") });

/** English translation of the terms of service (`/en/terms`); texts in `content/en/legal.ts`. */
export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.terms, ...META })} />
      <LegalPage doc={TERMS_EN} locale="en" alternate={LEGAL_PATHS.termini} />
    </>
  );
}
