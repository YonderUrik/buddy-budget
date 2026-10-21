import type { HeroText } from "@/content/home";
import { LOCALE_APP_LINKS } from "@/content/site";
import type { Locale } from "@/lib/i18n";
import { rise } from "@/lib/motion/rise";
import { ByRulesText } from "../by-rules";
import { CtaLink } from "../cta-link";
import { PhoneShot } from "../phone-shot";
import { ScreenCrop } from "./screen-crop";

export interface HeroProps {
  text: HeroText;
  locale: Locale;
}

/**
 * The opening («Type and nothing else», taste-skill direction): a navy field holding only the statement, set across
 * the width in two lines of the tall display face, one sentence at the bottom left and the two buttons at the bottom
 * right. The first picture, the real Panoramica (the phone capture on the phone), follows as its own band on the next field.
 */
export function Hero({ text, locale }: HeroProps) {
  const links = LOCALE_APP_LINKS[locale];
  return (
    <>
      <section className="hero" aria-labelledby="hero-t" data-field="navy">
        <div className="wrap">
          <h1 id="hero-t">
            <span>
              <span>{text.title[0]}</span>
            </span>{" "}
            <span>
              <span>{text.title[1]}</span>
            </span>
          </h1>
          <div className="hero-foot">
            <p className="lede" data-rise style={rise(1)}><ByRulesText text={text.lede} /></p>
            <div className="cta" id="hero-cta" data-rise style={rise(2)}>
              <CtaLink className="btn sun" href={links.signup} location="hero" target="signup" lang={locale} arrow>
                {text.cta}
              </CtaLink>
              <CtaLink className="btn line" href={links.demo} location="hero" demo lang={locale}>
                {text.demo}
              </CtaLink>
            </div>
          </div>
        </div>
      </section>
      <div className="hero-shot" data-field="alt">
        <div className="wrap">
          <ScreenCrop id="panoramica" top priority locale={locale} sizes="(max-width: 1000px) 100vw, 1152px" className="drift hs-desk" />
          <PhoneShot id="panoramica" locale={locale} className="drift hs-phone" />
        </div>
      </div>
    </>
  );
}
