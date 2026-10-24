import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { GuideExample } from "@/components/guide-example";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { Sources } from "@/components/sources";
import { YearsStrip } from "@/components/viz/viz";
import { GUIDE_ZAINETTO_EN, SOURCES_CHECKED_EN, SOURCES_EN, SOURCES_SUMMARY_EN } from "@/content/en/tools";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT } from "@/content/seo-pages";
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
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.guideZainetto, title: GUIDE_ZAINETTO_EN.title, description, type: "Article", extra: { author: { "@type": "Organization", name: "BuddyBudget" } } })} />
      <h2>What it is</h2>
      <p>When you sell stocks, ETFs or other instruments for more than you paid, you have a capital gain (plusvalenza), and in Italy you usually pay 26% on it. If you get back less, you have a capital loss (minusvalenza). Losses can offset gains in the same income category and lower the tax. The ones you can&apos;t use right away stay &ldquo;in the backpack&rdquo;.</p>
      <h2>How long a loss lasts</h2>
      <YearsStrip from={2023} label="A loss from 2023 can be used until 2027" locale="en" />
      <p>A loss can be carried forward up to the fourth year after the one in which you made it. A loss from 2023 can be used until 2027; from 2028 it has expired. If you have more than one loss, you usually start from the oldest.</p>
      <h2>An example</h2>
      <GuideExample locale="en" />
      <p>You offset the €1,500 from 2023 first, then €1,500 of the €2,000 from 2025. The taxable amount is zero, the tax avoided is €780 (26% of 3,000) and €500 of losses are left, usable until 2029. Try your own numbers in the <Link href={EN_PATHS.zainetto}>zainetto fiscale calculator</Link>.</p>
      <h2>What goes into the zainetto, instrument by instrument</h2>
      <p>The zainetto collects the losses that Italian tax law calls redditi diversi. Not every instrument works the same way, and the difference that matters most is the one for ETFs.</p>
      <ul>
        <li><b>Stocks, corporate bonds, ETCs and certificates</b>: gains and losses are both redditi diversi. A loss goes into the zainetto and a gain can use it.</li>
        <li><b>ETFs and funds</b>: a loss goes into the zainetto, but a gain is investment income (reddito di capitale) and pays the full 26% even when the zainetto is full. To use your losses you need gains on stocks, bonds, ETCs or certificates.</li>
        <li><b>Italian government bonds (BTP, BOT and similar)</b>: a gain pays 12.5%. For offsetting, gains and losses count at 48.08% of their amount, so that the two rates even out.</li>
        <li><b>Crypto-assets</b>: they are counted separately, once a year, at the crypto rate (33% from 2026). Their losses are also carried forward for four years.</li>
      </ul>
      <h2>Two cases that catch people out</h2>
      <h3>A gain on an ETF</h3>
      <p>You have €2,000 in the zainetto and sell an ETF with a €1,000 gain: you pay €260 (26% of 1,000) and the zainetto stays at €2,000. If the same €1,000 gain comes from a stock, the tax is zero and €1,000 is left in the zainetto. Someone who only holds ETFs can pile up losses they will never use.</p>
      <h3>A loss on a BTP</h3>
      <p>You sell a BTP at a €1,000 loss: €480.77 goes into the zainetto (48.08% of 1,000), not €1,000. The other way round, a €1,000 gain on a BTP uses at most €480.77 of the zainetto, and without losses it pays €125, which is 12.5% of 1,000.</p>
      <h2>Regime amministrato or regime dichiarativo</h2>
      <p>If your broker works under the regime amministrato (the broker handles the tax for you), it usually keeps track of your losses and applies the offsets at each sale, in date order: a loss only offsets gains that come after it, not the ones already taxed earlier in the same year. Under the regime dichiarativo (you declare gains in your own tax return), you add up the results of the whole year and report them in the quadro RT of the return. The order of the sales doesn&apos;t matter there, but keeping track of your losses and when they expire is up to you.</p>
      <h2>If you change bank or broker</h2>
      <p>Under the regime amministrato every broker has its own zainetto: a loss made at one bank doesn&apos;t lower the tax on a gain made at another by itself. When you close a securities account, the broker gives you a certificate of the unused losses. With it you can move them to another account held by the same people, or use them in your tax return, always within the four years. Ask for the certificate before you close the account: without it, rebuilding your losses is hard.</p>
      <h2>At the end of the year, before they expire</h2>
      <ul>
        <li>Check your broker&apos;s statement for how much you have in losses and the year each one expires: the losses made four years ago are in their last usable year and expire on 31 December.</li>
        <li>If you hold something other than ETFs at a gain, selling it before the expiry lets you use them. Count the fees, and remember that if you buy back, your cost basis starts again from the new price.</li>
        <li>If you use more than one broker, keep a single list: that is where losses most often get lost.</li>
      </ul>
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
      <h3>Do losses pass to the heirs?</h3>
      <p>In general, no: capital losses are personal and stay with whoever made them. For a real case, ask a tax adviser (commercialista).</p>
      <Sources items={[SOURCES_EN.tuir68, SOURCES_EN.dlgs461, SOURCES_EN.circolare19e, SOURCES_EN.quadroRt]} checked={SOURCES_CHECKED_EN} summary={SOURCES_SUMMARY_EN} locale="en" />
    </ContentPage>
  );
}
