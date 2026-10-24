import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { Sources } from "@/components/sources";
import { ZainettoCalculator } from "@/components/tools/zainetto-calculator";
import { SOURCES_CHECKED_EN, SOURCES_EN, SOURCES_SUMMARY_EN, ZAINETTO_PAGE_EN } from "@/content/en/tools";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT } from "@/content/seo-pages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: ZAINETTO_PAGE_EN.title,
  description: ZAINETTO_PAGE_EN.description,
  alternates: languageAlternates(EN_PATHS.zainetto, "en"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

/** English zainetto fiscale calculator (`/en/calculators/zainetto-fiscale`): the Italian rules, explained in English. */
export default function Page() {
  return (
    <ContentPage
      title={ZAINETTO_PAGE_EN.h1}
      lead={ZAINETTO_PAGE_EN.lead}
      current={EN_PATHS.zainetto}
      locale="en"
      crumbs={[{ href: EN_PATHS.home, label: "Home" }, { href: EN_PATHS.calculators, label: "Calculators" }, { label: "Zainetto fiscale" }]}
      ctaTitle="The zainetto keeps itself up to date."
      ctaText="In BuddyBudget, your losses, their four-year expiry, bollo (stamp duty) and the tax on a sale you are thinking about are worked out from your trades. There's no spreadsheet to redo every year."
      ctaLocation="calcolatore_zainetto"
    >
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.zainetto, title: ZAINETTO_PAGE_EN.title, description: ZAINETTO_PAGE_EN.description })} />
      <ZainettoCalculator locale="en" />
      <p className="note">Simplified estimate: a single income category, no statutory rounding, and no special weighting for government bonds. It does not replace your broker&apos;s statement or an adviser.</p>
      <h2>How the calculation works</h2>
      <ul>
        <li>Capital losses (minusvalenze) offset capital gains (plusvalenze) in the same income category, called redditi diversi in Italian tax law.</li>
        <li>A loss can be carried forward up to the fourth year after the one in which you made it: a loss from 2023 can be used until 2027.</li>
        <li>As a rule you start from the oldest losses, because they expire first. The calculator does the same.</li>
        <li>You pay 26% on what is left after the offset, or 12.5% on government bonds such as BTPs (Italian Treasury bonds).</li>
      </ul>
      <p>Want the logic with examples? Read the <Link href={EN_PATHS.guideZainetto}>guide to the zainetto fiscale</Link>.</p>
      <h2>Other tools</h2>
      <div className="related">
        <Link href={EN_PATHS.loanAmortization}>Loan amortization<span>Payment, interest and early repayment of a loan.</span></Link>
        <Link href={EN_PATHS.featureInvestments}>Investments with Italian taxes<span>How BuddyBudget works out returns, the zainetto and bollo (stamp duty).</span></Link>
      </div>
      <Sources items={[SOURCES_EN.tuir68, SOURCES_EN.circolare19e, SOURCES_EN.quadroRt]} checked={SOURCES_CHECKED_EN} summary={SOURCES_SUMMARY_EN} locale="en" />
    </ContentPage>
  );
}
