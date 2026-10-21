import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { ObiettivoCalculator } from "@/components/tools/obiettivo-calculator";
import { OBIETTIVO_PAGE_EN } from "@/content/en/tools";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: OBIETTIVO_PAGE_EN.title,
  description: OBIETTIVO_PAGE_EN.description,
  alternates: languageAlternates(EN_PATHS.savingsGoal, "en"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

/** English savings goal calculator (`/en/calculators/savings-goal`). */
export default function Page() {
  return (
    <ContentPage
      title={OBIETTIVO_PAGE_EN.h1}
      lead={OBIETTIVO_PAGE_EN.lead}
      current={EN_PATHS.savingsGoal}
      locale="en"
      crumbs={[{ href: EN_PATHS.home, label: "Home" }, { href: EN_PATHS.calculators, label: "Calculators" }, { label: "Savings goal" }]}
      ctaTitle="Your goals, with your real money."
      ctaText="In BuddyBudget, what you put aside each month is read from your connected accounts. You create a goal, choose which accounts or investments the money comes from, and see when you get there, whether your savings cover every goal and how far each one moves the year you can stop working."
      ctaLocation="calcolatore_obiettivo"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: OBIETTIVO_PAGE_EN.h1, url: `${SITE_URL}${EN_PATHS.savingsGoal}`, inLanguage: "en", description: OBIETTIVO_PAGE_EN.description, isPartOf: { "@id": `${SITE_URL}/#website` } }} />
      <ObiettivoCalculator locale="en" />
      <p className="note">Simplified estimate: equal deposits at the end of each month, a steady return compounded monthly, no tax on the return and no inflation. A savings account or a fund grows differently.</p>
      <h2>How the calculation works</h2>
      <ul>
        <li>With no return, the number of months is the gap between the goal and what you have, divided by the monthly deposit.</li>
        <li>With a return, each month the balance grows by the monthly rate (the annual return divided by twelve) and the deposit is added. This is the future value of an annuity.</li>
        <li>The month you get there is the first one in which the balance passes the goal.</li>
        <li>The return here is before tax. In Italy, gains on a savings account or an investment are taxed at 26% (12.5% on government bonds).</li>
      </ul>
      <h2>Other tools</h2>
      <div className="related">
        <Link href={EN_PATHS.zainetto} data-needs="taxes">Zainetto fiscale<span>Capital losses, their expiry and the tax on a gain.</span></Link>
        <Link href={EN_PATHS.loanAmortization}>Loan amortization<span>Payment, interest and early repayment of a loan.</span></Link>
      </div>
    </ContentPage>
  );
}
