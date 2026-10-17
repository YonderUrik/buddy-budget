import "./closing.css";
import { LOCALE_APP_LINKS } from "@/content/site";
import type { LandingEvents } from "@/lib/analytics";
import type { Locale } from "@/lib/i18n";
import { rise } from "@/lib/motion/rise";
import { CtaLink } from "../cta-link";
import { TrackedSection } from "../tracked-section";

export interface ClosingProps {
  title: string;
  /** One sentence on the bottom row, before the links. */
  note?: string;
  /** Label of the main button; it always goes to the app. */
  cta: string;
  /** Label of the link towards the public demo of the app; without it the link is not shown. */
  demo?: string;
  /** Where the click is counted (`cta_click`, `demo_click`). */
  ctaLocation: LandingEvents["cta_click"]["location"];
  /** Optional last link (e.g. the calculators). */
  secondary?: { href: string; label: string; target: LandingEvents["cta_click"]["target"] };
  /** The home's version: the field fills the screen. Content pages end on a shorter one. */
  full?: boolean;
  locale?: Locale;
}

/**
 * The close, on the navy field (the page's colours inverted): the idea again as a big headline at the top left, and
 * on one bottom row the sentence with the demo link at the left and the single sign-up button at the right. The
 * same on the home (`full`, a whole screen) and at the end of every content page.
 */
export function Closing({ title, note, cta, demo, ctaLocation, secondary, full = false, locale = "it" }: ClosingProps) {
  const links = LOCALE_APP_LINKS[locale];
  return (
    <TrackedSection id="fine" section="fine" className={`close${full ? " full" : ""}`} field="navy">
      <div className="wrap">
        <h2 data-rise>{title}</h2>
        <div className="close-foot">
          <p data-rise style={rise(1)}>
            {note ? <span>{note} </span> : null}
            {demo ? (
              <CtaLink className="tlink" href={links.demo} location={ctaLocation} demo lang={locale}>
                {demo}
              </CtaLink>
            ) : null}
            {secondary ? (
              <>
                {" · "}
                <CtaLink className="tlink" href={secondary.href} location={ctaLocation} target={secondary.target} lang={locale}>
                  {secondary.label}
                </CtaLink>
              </>
            ) : null}
          </p>
          <div data-rise style={rise(2)}>
            <CtaLink className="btn sun big" href={links.signup} location={ctaLocation} target="signup" lang={locale} arrow>
              {cta}
            </CtaLink>
          </div>
        </div>
      </div>
    </TrackedSection>
  );
}
