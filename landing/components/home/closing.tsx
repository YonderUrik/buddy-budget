import "./closing.css";
import { APP_LINKS } from "@/content/site";
import type { LandingEvents } from "@/lib/analytics";
import { CtaLink } from "../cta-link";
import { TrackedSection } from "../tracked-section";

export interface ClosingProps {
  title: string;
  /** One sentence under the title (how you get in). */
  note: string;
  /** Label of the main button; it always goes to the app. */
  cta: string;
  /** Where the click is counted (`cta_click`). */
  ctaLocation: LandingEvents["cta_click"]["location"];
  /** Optional second button (e.g. the calculators). */
  secondary?: { href: string; label: string; target: LandingEvents["cta_click"]["target"] };
}

/** Navy closing with the invitation to create the account; the same on the home and at the end of every content page. */
export function Closing({ title, note, cta, ctaLocation, secondary }: ClosingProps) {
  return (
    <TrackedSection id="fine" section="fine" className="close">
      <div className="wrap">
        <h2>{title}</h2>
        <p>{note}</p>
        <div className="cta">
          <CtaLink className="btn ghost" href={APP_LINKS.signup} location={ctaLocation} target="signup" arrow>
            {cta}
          </CtaLink>
          {secondary ? (
            <CtaLink className="btn plain" href={secondary.href} location={ctaLocation} target={secondary.target}>
              {secondary.label}
            </CtaLink>
          ) : null}
        </div>
      </div>
    </TrackedSection>
  );
}
