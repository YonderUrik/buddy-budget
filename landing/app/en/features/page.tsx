import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { ByRulesText } from "@/components/by-rules";
import { FeatureAreas, featureCountByRules } from "@/components/feature-areas";
import { JsonLd } from "@/components/json-ld";
import { FEATURE_AREAS, FEATURES } from "@/content/catalog.generated";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { SITE_URL } from "@/content/site";
import { pageMetadata } from "@/lib/page-metadata";

const TITLE = "All BuddyBudget features: accounts, investments, pension and debts";
const DESCRIPTION = "Everything BuddyBudget does, area by area: accounts, transactions, investments with Italian taxes, debts and net worth.";

export const metadata: Metadata = pageMetadata("en", {
  title: TITLE,
  description: DESCRIPTION,
  alternates: languageAlternates(EN_PATHS.features, "en"),
});

/** English features page: the shared catalog with its English texts (`en` of each entry in `lib/features/catalog.ts`). */
export default function Page() {
  return (
    <ContentPage
      title="All the features"
      lead={<><ByRulesText text={featureCountByRules(FEATURES)} /> features in {FEATURE_AREAS.length} areas. It&apos;s the same list the app uses: when we add one, it shows up here too.</>}
      current={EN_PATHS.features}
      locale="en"
      wide
      disclaimer={false}
      crumbs={[{ href: EN_PATHS.home, label: "BuddyBudget" }, { label: "Features" }]}
      ctaTitle="Try them with your own data."
      ctaText="Connect your bank read-only or add an account by hand, and see the whole picture in a few minutes."
      ctaLocation="funzioni"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${EN_PATHS.features}`, inLanguage: "en" }} />
      <FeatureAreas locale="en" />
    </ContentPage>
  );
}
