import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY } from "@/content/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("it", {
  title: `${PRIVACY.title} · BuddyBudget`,
  description: PRIVACY.description,
  alternates: languageAlternates("/privacy", "it"),
});

export default function Page() {
  return <LegalPage doc={PRIVACY} alternate={EN_PATHS.privacy} />;
}
