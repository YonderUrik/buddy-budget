import type { Metadata } from "next";
import { HomePage } from "@/components/home/home-page";
import { HOME_EN, SITE_DESCRIPTION_EN, SITE_TITLE_EN } from "@/content/en/home";
import { EN_PATHS, languageAlternates } from "@/content/locales";

export const metadata: Metadata = {
  title: SITE_TITLE_EN,
  description: SITE_DESCRIPTION_EN,
  alternates: languageAlternates(EN_PATHS.home, "en"),
};

/** English home (`/en`); texts in `content/en/home.ts`. */
export default function Page() {
  return <HomePage content={HOME_EN} />;
}
