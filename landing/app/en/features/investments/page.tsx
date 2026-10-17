import type { Metadata } from "next";
import { InvestmentsPage } from "@/components/investments-page";
import { INVESTMENTS_EN } from "@/content/feature-investments";
import { languageAlternates } from "@/content/locales";

export const metadata: Metadata = {
  title: INVESTMENTS_EN.title,
  description: INVESTMENTS_EN.description,
  alternates: languageAlternates(INVESTMENTS_EN.path, "en"),
};

export default function Page() {
  return <InvestmentsPage content={INVESTMENTS_EN} />;
}
