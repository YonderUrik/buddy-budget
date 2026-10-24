import type { Metadata } from "next";
import { ChangelogPage } from "@/components/project-pages";
import { PROJECT_EN } from "@/content/en/project";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: PROJECT_EN.changelog.metaTitle,
  description: PROJECT_EN.changelog.description,
  alternates: languageAlternates(EN_PATHS.changelog, "en"),
});

/** English `/en/changelog`; texts in `content/en/project.ts`. */
export default function Page() {
  return <ChangelogPage content={PROJECT_EN} path={EN_PATHS.changelog} />;
}
