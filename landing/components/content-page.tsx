import { t as trLanding } from "@/lib/localization";
import "./legal-page.css";
import "./content-page.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_LINKS } from "@/content/site";
import { SiteNav } from "./site-nav";
import { SiteFooter } from "./site-footer";
import { CtaLink } from "./cta-link";
import type { LandingEvents } from "@/lib/analytics";

type CtaLocation = LandingEvents["cta_click"]["location"];

export interface Crumb {
  href?: string;
  label: string;
}

/**
 * Cornice delle pagine di contenuto (calcolatori, guide, funzioni): lo stesso menu della home, intestazione sulla griglia del foglio, briciole, corpo e invito finale in una card come la chiusura della home.
 * `kicker` è l'etichetta sopra il titolo (come nelle sezioni della home). `current` è il percorso della pagina (evidenzia la voce del menu); `disclaimer` mostra l'avviso fiscale in fondo al corpo
 * (da spegnere nelle pagine senza stime); `wide` allarga il corpo per gallerie e cataloghi.
 */
export function ContentPage({ crumbs, children, ctaTitle, ctaText, ctaLocation, current, kicker, disclaimer = true, wide = false }: { crumbs: readonly Crumb[]; children: ReactNode; ctaTitle: string; ctaText: string; ctaLocation: CtaLocation; current?: string; kicker?: string; disclaimer?: boolean; wide?: boolean }) {
  return (
    <>
      <SiteNav current={current} />
      <main className="cp">
        <div className={`wrap cp-wrap${wide ? " cp-wide" : ""}`}>
          <nav className="cp-crumbs" aria-label={trLanding("Percorso")}>
            {crumbs.map((c, i) => (
              <span key={c.label}>{c.href ? <Link href={c.href}>{trLanding(c.label)}</Link> : trLanding(c.label)}{trLanding(i < crumbs.length - 1 ? " / " : "")}</span>
            ))}
          </nav>
          {kicker ? <span className="kicker">{trLanding(kicker)}</span> : null}
          {children}
          {disclaimer ? <p className="cp-disclaimer" role="note"><strong>{trLanding("Solo a scopo informativo.")}</strong>{trLanding(" I calcoli sono stime semplificate e i testi riassumono norme che cambiano: non sono consulenza fiscale né un riferimento assoluto. Verifica sempre con il tuo intermediario, la normativa in vigore o un consulente.")}</p> : null}
        </div>
        <aside className="cp-cta">
          <div className={`wrap cp-wrap${wide ? " cp-wide" : ""}`}>
            <div className="cp-cta-panel cell">
              <div>
                <h2>{trLanding(ctaTitle)}</h2>
                <p>{trLanding(ctaText)}</p>
              </div>
              <CtaLink className="btn main" href={APP_LINKS.signup} location={ctaLocation} target="signup" arrow>{trLanding("Crea un account")}</CtaLink>
            </div>
          </div>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}
