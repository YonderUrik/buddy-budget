import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { TERMINI } from "@/content/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("it", {
  title: `${TERMINI.title} · BuddyBudget`,
  description: TERMINI.description,
  alternates: languageAlternates("/termini", "it"),
});

export default function Page() {
  return <LegalPage doc={TERMINI} alternate={EN_PATHS.terms} />;
}
