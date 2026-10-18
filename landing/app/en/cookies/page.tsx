import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_PATHS } from "@/content/legal";
import { COOKIES_EN } from "@/content/en/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: `${COOKIES_EN.title} · BuddyBudget`,
  description: COOKIES_EN.description,
  alternates: languageAlternates(EN_PATHS.cookies, "en"),
});

/** English translation of the cookie page (`/en/cookies`); texts in `content/en/legal.ts`. */
export default function Page() {
  return <LegalPage doc={COOKIES_EN} locale="en" alternate={LEGAL_PATHS.cookie} />;
}
