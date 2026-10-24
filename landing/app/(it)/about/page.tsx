import type { Metadata } from "next";
import { AboutPage } from "@/components/project-pages";
import { languageAlternates } from "@/content/locales";
import { PROJECT_IT } from "@/content/project";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("it", {
  title: PROJECT_IT.about.metaTitle,
  description: PROJECT_IT.about.description,
  alternates: languageAlternates(CONTENT_PATHS.about, "it"),
});

/** `/about` in Italian; texts in `content/project.ts`, layout in `AboutPage`. */
export default function Page() {
  return <AboutPage content={PROJECT_IT} path={CONTENT_PATHS.about} />;
}
