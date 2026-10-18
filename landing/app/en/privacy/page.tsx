import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_PATHS } from "@/content/legal";
import { PRIVACY_EN } from "@/content/en/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: `${PRIVACY_EN.title} · BuddyBudget`,
  description: PRIVACY_EN.description,
  alternates: languageAlternates(EN_PATHS.privacy, "en"),
});

/** English translation of the privacy policy (`/en/privacy`); texts in `content/en/legal.ts`. */
export default function Page() {
  return <LegalPage doc={PRIVACY_EN} locale="en" alternate={LEGAL_PATHS.privacy} />;
}
