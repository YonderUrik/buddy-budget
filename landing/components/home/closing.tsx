import "./closing.css";
import { LOCALE_APP_LINKS } from "@/content/site";
import type { LandingEvents } from "@/lib/analytics";
import type { Locale } from "@/lib/i18n";
import { CtaLink } from "../cta-link";
import { TrackedSection } from "../tracked-section";

export interface ClosingProps {
  title: string;
  /** One sentence under the title; the home leaves it out. */
  note?: string;
  /** Label of the main button; it always goes to the app. */
  cta: string;
  /** Label of the button towards the public demo of the app; without it the button is not shown. */
  demo?: string;
  /** Where the click is counted (`cta_click`, `demo_click`). */
  ctaLocation: LandingEvents["cta_click"]["location"];
  /** Optional last button (e.g. the calculators). */
  secondary?: { href: string; label: string; target: LandingEvents["cta_click"]["target"] };
  locale?: Locale;
}

/** Navy closing with the invitation to create the account (and to try the demo); the same on the home and at the end of every content page. */
export function Closing({ title, note, cta, demo, ctaLocation, secondary, locale = "it" }: ClosingProps) {
  const links = LOCALE_APP_LINKS[locale];
  return (
    <TrackedSection id="fine" section="fine" className="close">
      <div className="wrap">
        <h2>{title}</h2>
        {note ? <p>{note}</p> : null}
        <div className="cta">
          <CtaLink className="btn sun" href={links.signup} location={ctaLocation} target="signup" lang={locale} arrow>
            {cta}
          </CtaLink>
          {demo ? (
            <CtaLink className="btn plain" href={links.demo} location={ctaLocation} demo lang={locale}>
              {demo}
            </CtaLink>
          ) : null}
          {secondary ? (
            <CtaLink className="btn plain" href={secondary.href} location={ctaLocation} target={secondary.target} lang={locale}>
              {secondary.label}
            </CtaLink>
          ) : null}
        </div>
      </div>
    </TrackedSection>
  );
}
