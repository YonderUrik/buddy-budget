import type { Metadata } from "next";
import { InvestmentsPage } from "@/components/investments-page";
import { INVESTMENTS_IT } from "@/content/feature-investments";
import { languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT } from "@/content/seo-pages";

export const metadata: Metadata = {
  title: INVESTMENTS_IT.title,
  description: INVESTMENTS_IT.description,
  alternates: languageAlternates(INVESTMENTS_IT.path, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return <InvestmentsPage content={INVESTMENTS_IT} />;
}
