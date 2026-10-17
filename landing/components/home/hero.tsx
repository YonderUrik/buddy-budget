import { ArrowDown } from "lucide-react";
import type { HeroText, SumText } from "@/content/home";
import { LOCALE_APP_LINKS } from "@/content/site";
import type { Locale } from "@/lib/i18n";
import { CtaLink } from "../cta-link";
import { ScreenCrop } from "./screen-crop";
import { SumCard } from "./sum-card";

/** Anchor of the section the «Come funziona» link scrolls to. */
const HOW_ANCHOR = "#come";

export interface HeroProps {
  text: HeroText;
  sum: SumText;
  locale: Locale;
}

/**
 * The opening on the navy ground: the promise in the tall display face, one sentence, the sign-up button and the
 * demo, with the sum card beside them. Right after it the Panoramica, big and full width, half on the navy and half
 * on the page (the product shown at once, as Hermes Agent does with its desktop app).
 */
export function Hero({ text, sum, locale }: HeroProps) {
  const links = LOCALE_APP_LINKS[locale];
  return (
    <>
      <section className="hero" aria-labelledby="hero-t">
        <div className="wrap">
          <div className="hero-copy">
            <h1 id="hero-t">{text.title}</h1>
            <p className="lede">{text.lede}</p>
            <div className="cta" id="hero-cta">
              <CtaLink className="btn sun" href={links.signup} location="hero" target="signup" lang={locale} arrow>
                {text.cta}
              </CtaLink>
              <CtaLink className="btn plain" href={links.demo} location="hero" demo lang={locale}>
                {text.demo}
              </CtaLink>
              <CtaLink className="how" href={HOW_ANCHOR} location="hero" target="how" lang={locale}>
                {text.how}
                <ArrowDown aria-hidden="true" strokeWidth={2} />
              </CtaLink>
            </div>
          </div>
          <SumCard text={sum} locale={locale} />
        </div>
      </section>
      <div className="wrap hero-shot">
        <ScreenCrop id="panoramica" top priority locale={locale} sizes="(max-width: 1000px) 100vw, 1152px" />
      </div>
    </>
  );
}
