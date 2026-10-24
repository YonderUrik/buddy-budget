import type { Metadata } from "next";
import { AboutPage } from "@/components/project-pages";
import { PROJECT_EN } from "@/content/en/project";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: PROJECT_EN.about.metaTitle,
  description: PROJECT_EN.about.description,
  alternates: languageAlternates(EN_PATHS.about, "en"),
});

/** English `/en/about`; texts in `content/en/project.ts`. */
export default function Page() {
  return <AboutPage content={PROJECT_EN} path={EN_PATHS.about} />;
}
