import { ArrowDown, Check } from "lucide-react";
import { HERO } from "@/content/home";
import { APP_LINKS } from "@/content/site";
import { CtaLink } from "../cta-link";
import { ScreenCrop } from "./screen-crop";
import { SumCard } from "./sum-card";

/** Anchor of the section the «Come funziona» link scrolls to. */
const HOW_ANCHOR = "#come";

/** The opening: the promise, one sentence, the button, the four trust facts; beside them the Panoramica with the sum pulled out of it. */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-t">
      <div className="wrap">
        <div className="hero-copy">
          <h1 id="hero-t">{HERO.title}</h1>
          <p className="lede">{HERO.lede}</p>
          <div className="cta" id="hero-cta">
            <CtaLink className="btn main" href={APP_LINKS.signup} location="hero" target="signup" arrow>
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
        <div className="hero-visual">
          <ScreenCrop id="panoramica" top priority />
          <SumCard />
        </div>
      </div>
    </section>
  );
}
