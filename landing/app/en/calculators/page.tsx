import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { TOOLS_EN, TOOLS_PAGE_EN } from "@/content/en/tools";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { RulesNote } from "@/components/by-rules";
import { RULES_NOTES } from "@/content/rules-needs";
import { pageMetadata } from "@/lib/page-metadata";
import { needsAttr } from "@/lib/visitor-country";

export const metadata: Metadata = pageMetadata("en", {
  title: TOOLS_PAGE_EN.title,
  description: TOOLS_PAGE_EN.description,
  alternates: languageAlternates(EN_PATHS.calculators, "en"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

/** English list of the free calculators (`/en/calculators`); texts in `content/en/tools.ts`. */
export default function Page() {
  return (
    <ContentPage
      title={TOOLS_PAGE_EN.h1}
      lead={TOOLS_PAGE_EN.lead}
      current={EN_PATHS.calculators}
      locale="en"
      crumbs={[{ href: EN_PATHS.home, label: "Home" }, { label: "Calculators" }]}
      ctaTitle="In the app, the numbers are your own."
      ctaText="The zainetto, loan payments and savings are worked out from your own trades and transactions, with nothing to type in again."
      ctaLocation="strumenti"
    >
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.calculators, title: TOOLS_PAGE_EN.title, description: TOOLS_PAGE_EN.description, extra: { hasPart: TOOLS_EN.map((t) => ({ "@type": "WebPage", name: t.name, url: `${SITE_URL}${t.href}` })) } })} />
      <div className="related">
        {TOOLS_EN.map((t) => (
          <Link key={t.id} href={t.href} data-needs={needsAttr(t.needs)}>{t.name}<span>{t.text}</span></Link>
        ))}
      </div>
      <RulesNote text={RULES_NOTES.en.taxes} />
      <h2 data-needs="taxes">Want to understand the logic?</h2>
      <div className="related" data-needs="taxes">
        <Link href={EN_PATHS.guideZainetto}>Guide to the zainetto fiscale<span>What it is and how the four years work, with examples and sources.</span></Link>
        <Link href={EN_PATHS.featureInvestments}>Investments with Italian taxes<span>How BuddyBudget works out returns, the zainetto and bollo (stamp duty).</span></Link>
      </div>
    </ContentPage>
  );
}
