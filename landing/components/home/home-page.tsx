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
import { MobileCta } from "./mobile-cta";
import { Showcase } from "./showcase";
import { Sources } from "./sources";
import { Trust } from "./trust";

export interface HomePageProps {
  content: HomeContent;
  /** Optional last button of the closing (the Italian home: the calculators). */
  secondary?: { href: string; label: string };
  /** Shown above the bar (the Italian home: the «also in English» line). */
  before?: ReactNode;
}

/**
 * «Un numero solo» home (2026-10-17) in one language: the sum in the opening, the four places money comes from,
 * what the number tells you every day (five real screens), why to trust it (facts, limits, open code), the
 * questions, the closing. On the phone a fixed bar carries the button between the opening and the closing.
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
        <Hero text={content.hero} sum={content.sum} locale={locale} />
        <Sources text={content.places} />
        <Showcase text={content.showcase} locale={locale} />
        <Trust text={content.trust} hood={content.hood} />
        <Faq text={content.faq} />
        <Closing
          title={content.close.title}
          cta={content.close.cta}
          demo={content.close.demo}
          ctaLocation="closing"
          locale={locale}
          secondary={secondary ? { ...secondary, target: "calculator" } : undefined}
        />
      </main>
      <MobileCta label={content.close.cta} login={content.login} locale={locale} />
      <SiteFooter locale={locale} alternate={alternate} />
    </>
  );
}
