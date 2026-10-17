import { ArrowDown, Check } from "lucide-react";
import { HERO } from "@/content/home";
import { APP_LINKS } from "@/content/site";
import { CtaLink } from "../cta-link";
import { ScreenCrop } from "./screen-crop";
import { SumCard } from "./sum-card";

/** Anchor of the section the «Come funziona» link scrolls to. */
const HOW_ANCHOR = "#come";

/**
 * The opening on the navy ground: the promise in the tall display face, one sentence, the button and the four trust
 * facts, with the sum card beside them. Right after it the Panoramica, big and full width, half on the navy and half
 * on the page (the product shown at once, as Hermes Agent does with its desktop app).
 */
export function Hero() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-t">
        <div className="wrap">
          <div className="hero-copy">
            <p className="idx">{HERO.index}</p>
            <h1 id="hero-t">{HERO.title}</h1>
            <p className="lede">{HERO.lede}</p>
            <div className="cta" id="hero-cta">
              <CtaLink className="btn ghost" href={APP_LINKS.signup} location="hero" target="signup" arrow>
                {HERO.cta}
              </CtaLink>
              <CtaLink className="how" href={HOW_ANCHOR} location="hero" target="how">
                {HERO.how}
                <ArrowDown aria-hidden="true" strokeWidth={2} />
              </CtaLink>
            </div>
            <ul className="trust">
              {HERO.trust.map((fact) => (
                <li key={fact}>
                  <Check aria-hidden="true" strokeWidth={2.5} />
                  {fact}
                </li>
              ))}
            </ul>
          </div>
          <SumCard />
        </div>
      </section>
      <div className="wrap hero-shot">
        <ScreenCrop id="panoramica" top priority sizes="(max-width: 1000px) 100vw, 1152px" />
        <p className="shot-cap">{HERO.shot}</p>
      </div>
    </>
  );
}
