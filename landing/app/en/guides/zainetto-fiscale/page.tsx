import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { GuideExample } from "@/components/guide-example";
import { JsonLd } from "@/components/json-ld";
import { Sources } from "@/components/sources";
import { YearsStrip } from "@/components/viz/viz";
import { GUIDE_ZAINETTO_EN, SOURCES_CHECKED_EN, SOURCES_EN, SOURCES_SUMMARY_EN } from "@/content/en/tools";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", {
  title: GUIDE_ZAINETTO_EN.title,
  description: GUIDE_ZAINETTO_EN.description,
  alternates: languageAlternates(EN_PATHS.guideZainetto, "en"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

/** English guide to the zainetto fiscale (`/en/guides/zainetto-fiscale`): the Italian rules on capital losses, with examples. */
export default function Page() {
  const { h1, description } = GUIDE_ZAINETTO_EN;
  return (
    <ContentPage
      title={h1}
      lead={<>If you sell an investment at a loss, the loss still has a use: under Italian tax law you can set it against your gains for four more years and pay less tax. This store of losses is called the zainetto fiscale, the &ldquo;tax backpack&rdquo;.</>}
      current={EN_PATHS.guideZainetto}
      locale="en"
      crumbs={[{ href: EN_PATHS.home, label: "Home" }, { label: "Guides" }, { label: "Zainetto fiscale" }]}
      ctaTitle="BuddyBudget keeps the zainetto for you."
      ctaText="BuddyBudget rebuilds your zainetto fiscale from your trades and tells you when a loss is about to expire."
      ctaLocation="guida_zainetto"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: h1, description, inLanguage: "en", mainEntityOfPage: `${SITE_URL}${EN_PATHS.guideZainetto}`, author: { "@type": "Organization", name: "BuddyBudget" }, publisher: { "@type": "Organization", name: "BuddyBudget" } }} />
      <h2>What it is</h2>
      <p>When you sell stocks, ETFs or other instruments for more than you paid, you have a capital gain (plusvalenza), and in Italy you usually pay 26% on it. If you get back less, you have a capital loss (minusvalenza). Losses can offset gains in the same income category and lower the tax. The ones you can&apos;t use right away stay &ldquo;in the backpack&rdquo;.</p>
      <h2>How long a loss lasts</h2>
      <YearsStrip from={2023} label="A loss from 2023 can be used until 2027" locale="en" />
      <p>A loss can be carried forward up to the fourth year after the one in which you made it. A loss from 2023 can be used until 2027; from 2028 it has expired. If you have more than one loss, you usually start from the oldest.</p>
      <h2>An example</h2>
      <GuideExample locale="en" />
      <p>You offset the €1,500 from 2023 first, then €1,500 of the €2,000 from 2025. The taxable amount is zero, the tax avoided is €780 (26% of 3,000) and €500 of losses are left, usable until 2029. Try your own numbers in the <Link href={EN_PATHS.zainetto}>zainetto fiscale calculator</Link>.</p>
      <h2>Regime amministrato or regime dichiarativo</h2>
      <p>If your broker works under the regime amministrato (the broker handles the tax for you), it usually keeps track of your losses and applies the offsets itself. If you are under the regime dichiarativo (you declare gains in your own tax return), or you use more than one broker, you have to report the losses in your tax return. Then keeping track of them is what stops them from expiring unused.</p>
      <h2>Common mistakes</h2>
      <div className="tips">
        <div><b>1</b><p>Letting a loss expire without using it.</p></div>
        <div><b>2</b><p>Forgetting the losses made with another broker.</p></div>
        <div><b>3</b><p>Mixing up the rules of different instruments: government bonds, funds and crypto each have their own treatment.</p></div>
      </div>
      <h2>Quick questions</h2>
      <h3>Do losses also offset dividends?</h3>
      <p>In general, no. Dividends are investment income (redditi di capitale) and capital gains are redditi diversi: they are separate categories. Check your own case.</p>
      <h3>Can I use the zainetto if I don&apos;t sell anything else?</h3>
      <p>You need a future gain to offset, before the four years run out.</p>
      <Sources items={[SOURCES_EN.tuir68, SOURCES_EN.circolare19e, SOURCES_EN.quadroRt]} checked={SOURCES_CHECKED_EN} summary={SOURCES_SUMMARY_EN} locale="en" />
    </ContentPage>
  );
}
