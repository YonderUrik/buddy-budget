import "./legal-page.css";
import "./content-page.css";
import type { ReactNode } from "react";
import { UI } from "@/content/ui";
import type { LandingEvents } from "@/lib/analytics";
import { counterpart } from "@/content/locales";
import { otherLocale, type Locale } from "@/lib/i18n";
import { BackLink } from "./back-link";
import { rise } from "@/lib/motion/rise";
import { Closing } from "./home/closing";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

type CtaLocation = LandingEvents["cta_click"]["location"];

export interface Crumb {
  href?: string;
  label: string;
}

export interface ContentPageProps {
  title: ReactNode;
  lead: ReactNode;
  crumbs: readonly Crumb[];
  children: ReactNode;
  ctaTitle: string;
  ctaText: string;
  ctaLocation: CtaLocation;
  current?: string;
  disclaimer?: boolean;
  wide?: boolean;
  locale?: Locale;
  /** The same page in the other language, for the «IT / EN» switch (default: that language's home, or the counterpart of `current`). */
  alternate?: string;
}

/**
 * Frame of the content pages (calculators, guides, features, security): the same navy bar as the home, a navy head
 * with the back link, the title in the display face and the lead, then the body on the light page and
 * the same navy closing as the home with a title and a sentence of this page.
 * `title` and `lead` open the page on the navy head. `crumbs` is the path from the home page: the nearest ancestor with an `href` becomes the «‹» back link above the title.
 * `current` is the path of the page
 * (highlights the menu entry); `disclaimer` shows the tax notice at the end of the body (off on pages without
 * estimates); `wide` widens the body for galleries and catalogs. `locale` picks the chrome texts (`UI`).
 */
export function ContentPage({ title, lead, crumbs, children, ctaTitle, ctaText, ctaLocation, current, disclaimer = true, wide = false, locale = "it", alternate }: ContentPageProps) {
  const t = UI[locale].content;
  const parent = crumbs.slice(0, -1).findLast((c) => c.href);
  const isHome = (href: string) => href === "/" || href === "/en";
  const switchTo = alternate ?? counterpart(current ?? "", otherLocale(locale));
  return (
    <>
      <SiteNav current={current} locale={locale} alternate={switchTo} />
      <main className="cp">
        <header className="cp-head" data-field="navy">
          <div className={`wrap cp-wrap${wide ? " cp-wide" : ""}`}>
            {parent ? <BackLink href={parent.href!} label={isHome(parent.href!) ? t.home : parent.label} /> : null}
            <h1 data-rise>{title}</h1>
            <p className="lead" data-rise style={rise(1)}>{lead}</p>
          </div>
        </header>
        <div data-field="light" className={`wrap cp-wrap cp-body${wide ? " cp-wide" : ""}`}>
          {children}
          {disclaimer ? <p className="cp-disclaimer" role="note"><strong>{t.disclaimerStrong}</strong> {t.disclaimer}</p> : null}
        </div>
        <Closing title={ctaTitle} note={ctaText} cta={t.cta} demo={t.demo} ctaLocation={ctaLocation} locale={locale} />
      </main>
      <SiteFooter locale={locale} alternate={switchTo} />
    </>
  );
}
