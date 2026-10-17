import "./legal-page.css";
import "./content-page.css";
import type { ReactNode } from "react";
import type { LandingEvents } from "@/lib/analytics";
import { BackLink } from "./back-link";
import { Closing } from "./home/closing";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

type CtaLocation = LandingEvents["cta_click"]["location"];

export interface Crumb {
  href?: string;
  label: string;
}

/** Label of the button in the closing of every content page (the same as the home). */
const CTA_LABEL = "Inizia gratis";

/**
 * Frame of the content pages (calculators, guides, features, security): the same menu as the home, title with a
 * short lead, the body, and the same navy closing as the home with a title and a sentence of this page.
 * `crumbs` is the path from the home page: the nearest ancestor with an `href` becomes the «‹» back link above the title.
 * `kicker` is the small label above the title («Calcolatore gratuito, senza account»). `current` is the path of the page
 * (highlights the menu entry); `disclaimer` shows the tax notice at the end of the body (off on pages without
 * estimates); `wide` widens the body for galleries and catalogs.
 */
export function ContentPage({ crumbs, children, ctaTitle, ctaText, ctaLocation, current, kicker, disclaimer = true, wide = false }: { crumbs: readonly Crumb[]; children: ReactNode; ctaTitle: string; ctaText: string; ctaLocation: CtaLocation; current?: string; kicker?: string; disclaimer?: boolean; wide?: boolean }) {
  const parent = crumbs.slice(0, -1).findLast((c) => c.href);
  return (
    <>
      <SiteNav current={current} />
      <main className="cp">
        <div className={`wrap cp-wrap${wide ? " cp-wide" : ""}`}>
          {parent ? <BackLink href={parent.href!} label={parent.href === "/" ? "Home" : parent.label} /> : null}
          {kicker ? <span className="kicker">{kicker}</span> : null}
          {children}
          {disclaimer ? <p className="cp-disclaimer" role="note"><strong>Solo a scopo informativo.</strong> I calcoli sono stime semplificate e i testi riassumono norme che cambiano: non sono consulenza fiscale né un riferimento assoluto. Verifica sempre con il tuo intermediario, la normativa in vigore o un consulente.</p> : null}
        </div>
        <Closing title={ctaTitle} note={ctaText} cta={CTA_LABEL} ctaLocation={ctaLocation} />
      </main>
      <SiteFooter />
    </>
  );
}
