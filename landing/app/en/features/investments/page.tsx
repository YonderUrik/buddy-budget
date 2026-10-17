import type { Metadata } from "next";
import { InvestmentsPage } from "@/components/investments-page";
import { INVESTMENTS_EN } from "@/content/feature-investments";
import { languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: INVESTMENTS_EN.title,
  description: INVESTMENTS_EN.description,
  alternates: languageAlternates(INVESTMENTS_EN.path, "en"),
});

export default function Page() {
  return <InvestmentsPage content={INVESTMENTS_EN} />;
}
