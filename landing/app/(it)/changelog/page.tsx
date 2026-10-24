import type { Metadata } from "next";
import { ChangelogPage } from "@/components/project-pages";
import { languageAlternates } from "@/content/locales";
import { PROJECT_IT } from "@/content/project";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("it", {
  title: PROJECT_IT.changelog.metaTitle,
  description: PROJECT_IT.changelog.description,
  alternates: languageAlternates(CONTENT_PATHS.changelog, "it"),
});

/** `/changelog` in Italian; texts in `content/project.ts`, layout in `ChangelogPage`. */
export default function Page() {
  return <ChangelogPage content={PROJECT_IT} path={CONTENT_PATHS.changelog} />;
}
