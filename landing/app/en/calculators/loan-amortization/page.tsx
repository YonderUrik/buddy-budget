import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { Sources } from "@/components/sources";
import { AmmortamentoCalculator } from "@/components/tools/ammortamento-calculator";
import { AMMORTAMENTO_PAGE_EN, SOURCES_CHECKED_EN, SOURCES_EN, SOURCES_SUMMARY_EN } from "@/content/en/tools";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT } from "@/content/seo-pages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: AMMORTAMENTO_PAGE_EN.title,
  description: AMMORTAMENTO_PAGE_EN.description,
  alternates: languageAlternates(EN_PATHS.loanAmortization, "en"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

/** English loan amortization calculator (`/en/calculators/loan-amortization`). */
export default function Page() {
  return (
    <ContentPage
      title={AMMORTAMENTO_PAGE_EN.h1}
      lead={AMMORTAMENTO_PAGE_EN.lead}
      current={EN_PATHS.loanAmortization}
      locale="en"
      crumbs={[{ href: EN_PATHS.home, label: "Home" }, { href: EN_PATHS.calculators, label: "Calculators" }, { label: "Loan amortization" }]}
      ctaTitle="All your debts in one place."
      ctaText="BuddyBudget works out the TAEG (the Italian APR) and compares paying off early with surroga (moving the mortgage to another bank), with interest saved, penalty and costs. The debt counts in your net worth."
      ctaLocation="calcolatore_ammortamento"
    >
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.loanAmortization, title: AMMORTAMENTO_PAGE_EN.title, description: AMMORTAMENTO_PAGE_EN.description })} />
      <AmmortamentoCalculator locale="en" />
      <p className="note">Fixed-payment (French) schedule, with the TAN (the nominal annual rate) and monthly payments. It leaves out arrangement fees, insurance and variable rates: for the real cost you need the TAEG (the APR) in your contract.</p>
      <h2>Same payment, less interest each month</h2>
      <p>In a French schedule the payment stays the same, but at the start almost all of it goes to interest; over time the share that pays off the principal grows. That&apos;s why paying off part of the loan early saves more than doing it near the end.</p>
      <p>The penalty field follows Italian rules: in Italy a home mortgage can be paid off early with no fees or penalties. For other loans, check your contract.</p>
      <h2 data-needs="taxes">Other tools</h2>
      <div className="related" data-needs="taxes">
        <Link href={EN_PATHS.zainetto}>Zainetto fiscale<span>Capital losses, their expiry and the tax on a gain.</span></Link>
        <Link href={EN_PATHS.featureInvestments}>Investments with Italian taxes<span>How BuddyBudget works out returns, the zainetto and bollo (stamp duty).</span></Link>
      </div>
      <Sources items={[SOURCES_EN.guidaMutuo, SOURCES_EN.prestitoPersonale]} checked={SOURCES_CHECKED_EN} summary={SOURCES_SUMMARY_EN} locale="en" />
    </ContentPage>
  );
}
