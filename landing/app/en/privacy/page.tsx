import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_PATHS } from "@/content/legal";
import { LEGAL_SUMMARY_EN } from "@/content/en/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: `${LEGAL_SUMMARY_EN.title} · BuddyBudget`,
  description: LEGAL_SUMMARY_EN.description,
  alternates: languageAlternates(EN_PATHS.privacy, "en"),
});

/** English summary of the legal texts (`/en/privacy`); texts in `content/en/legal.ts`. */
export default function Page() {
  return <LegalPage doc={LEGAL_SUMMARY_EN} locale="en" alternate={LEGAL_PATHS.privacy} />;
}
