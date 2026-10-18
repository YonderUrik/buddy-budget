import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { COOKIE } from "@/content/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("it", {
  title: `${COOKIE.title} · BuddyBudget`,
  description: COOKIE.description,
  alternates: languageAlternates("/cookie", "it"),
});

export default function Page() {
  return <LegalPage doc={COOKIE} alternate={EN_PATHS.cookies} />;
}
