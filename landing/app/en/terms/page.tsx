import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_PATHS } from "@/content/legal";
import { TERMS_EN } from "@/content/en/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: `${TERMS_EN.title} · BuddyBudget`,
  description: TERMS_EN.description,
  alternates: languageAlternates(EN_PATHS.terms, "en"),
});

/** English translation of the terms of service (`/en/terms`); texts in `content/en/legal.ts`. */
export default function Page() {
  return <LegalPage doc={TERMS_EN} locale="en" alternate={LEGAL_PATHS.termini} />;
}
