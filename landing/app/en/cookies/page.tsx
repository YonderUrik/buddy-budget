import type { Metadata } from "next";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_PATHS } from "@/content/legal";
import { COOKIES_EN } from "@/content/en/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

const META = {
  title: `${COOKIES_EN.title} · BuddyBudget`,
  // Longer than the lead on the page: search results show 110-160 characters.
  description: "Which cookies and similar tools the BuddyBudget site and app use, what each is for and why there is no consent banner: only technical tools and anonymous stats.",
};

export const metadata: Metadata = pageMetadata("en", { ...META, alternates: languageAlternates(EN_PATHS.cookies, "en") });

/** English translation of the cookie page (`/en/cookies`); texts in `content/en/legal.ts`. */
export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.cookies, ...META })} />
      <LegalPage doc={COOKIES_EN} locale="en" alternate={LEGAL_PATHS.cookie} />
    </>
  );
}
