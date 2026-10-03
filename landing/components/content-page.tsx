import "./legal-page.css";
import "./content-page.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_LINKS } from "@/content/site";
import { PageBar } from "./page-bar";
import { SiteFooter } from "./site-footer";
import { ARROW_ICON, CtaLink } from "./cta-link";
import type { LandingEvents } from "@/lib/analytics";

type CtaLocation = LandingEvents["cta_click"]["location"];

export interface Crumb {
  href?: string;
  label: string;
}

const NAV = [
  { href: "/strumenti/zainetto-fiscale", label: "Calcolatori" },
  { href: "/guide/zainetto-fiscale", label: "Guide" },
  { href: "/funzioni", label: "Funzioni" },
  { href: "/schermate", label: "Schermate" },
] as const;

/** Cornice delle pagine di contenuto (calcolatori, guide, funzioni): intestazione col marchio, briciole, corpo e invito finale. `disclaimer` mostra l'avviso fiscale (da spegnere nelle pagine senza stime); `wide` allarga il corpo per gallerie e cataloghi. */
export function ContentPage({ crumbs, children, ctaTitle, ctaText, ctaLocation, disclaimer = true, wide = false }: { crumbs: readonly Crumb[]; children: ReactNode; ctaTitle: string; ctaText: string; ctaLocation: CtaLocation; disclaimer?: boolean; wide?: boolean }) {
  return (
    <>
      <PageBar label="Sezioni del sito" links={NAV} action={<CtaLink className="btn main sm" href={APP_LINKS.signup} location={ctaLocation} target="signup">Prova gratis</CtaLink>} />
      <main className="cp">
        <div className={`wrap cp-wrap${wide ? " cp-wide" : ""}`}>
          <nav className="cp-crumbs" aria-label="Percorso">
            {crumbs.map((c, i) => (
              <span key={c.label}>{c.href ? <Link href={c.href}>{c.label}</Link> : c.label}{i < crumbs.length - 1 ? " / " : ""}</span>
            ))}
          </nav>
          {disclaimer ? <p className="cp-disclaimer" role="note"><strong>Solo a scopo informativo.</strong> I calcoli sono stime semplificate e i testi riassumono norme che cambiano: non sono consulenza fiscale né un riferimento assoluto. Verifica sempre con il tuo intermediario, la normativa in vigore o un consulente.</p> : null}
          {children}
        </div>
        <aside className="cp-cta">
          <div className={`wrap cp-wrap${wide ? " cp-wide" : ""}`}>
            <h2>{ctaTitle}</h2>
            <p>{ctaText}</p>
            <CtaLink className="btn main" href={APP_LINKS.signup} location={ctaLocation} target="signup">
              Prova gratis{ARROW_ICON}
            </CtaLink>
          </div>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}
