import "./home.css";
import type { ReactNode } from "react";
import type { HomeContent } from "@/content/home";
import { HOME_PATH } from "@/content/locales";
import { SITE_URL } from "@/content/site";
import { otherLocale } from "@/lib/i18n";
import { JsonLd } from "../json-ld";
import { SiteFooter } from "../site-footer";
import { SiteNav } from "../site-nav";
import { Closing } from "./closing";
import { Faq } from "./faq";
import { Hero } from "./hero";
import { Showcase } from "./showcase";
import { SumList } from "./sum-list";
import { TaxCompare } from "./tax-compare";
import { Trust } from "./trust";

export interface HomePageProps {
  content: HomeContent;
  /** Optional last link of the closing (the Italian home: the calculators). */
  secondary?: { href: string; label: string };
  /** Shown above the bar (the Italian home: the «also in English» line). */
  before?: ReactNode;
}

/**
 * The home in one language, after the taste-skill direction «Type and nothing else» (2026-10-17): the statement alone
 * on the navy field, the real Panoramica as the first picture, the four places as a live sum the visitor can rewrite,
 * what the number tells you (four real screens), the net after tax on the yellow field, why to trust it as a table
 * with the code under it, the questions, the close on the navy field. The bar is sticky and takes the colours of the
 * field under it (`data-field`).
 */
export function HomePage({ content, secondary, before }: HomePageProps) {
  const { locale } = content;
  const home = HOME_PATH[locale];
  // Structured FAQ data: the same questions as the visible section, only on the homes.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}${home === "/" ? "" : home}/#faq`,
    mainEntity: content.faq.items.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
  };
  const alternate = HOME_PATH[otherLocale(locale)];
  return (
    <>
      <JsonLd data={faqJsonLd} />
      {before}
      <SiteNav locale={locale} alternate={alternate} />
      <main className="home">
        <Hero text={content.hero} locale={locale} />
        <SumList places={content.places} sum={content.sum} locale={locale} />
        <Showcase text={content.showcase} locale={locale} />
        <TaxCompare text={content.tax} />
        <Trust text={content.trust} hood={content.hood} />
        <Faq text={content.faq} />
        <Closing
          title={content.close.title}
          note={content.close.note}
          cta={content.close.cta}
          demo={content.close.demo}
          ctaLocation="closing"
          locale={locale}
          full
          secondary={secondary ? { ...secondary, target: "calculator" } : undefined}
        />
      </main>
      <SiteFooter locale={locale} alternate={alternate} />
    </>
  );
}
