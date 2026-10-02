import "./legal-page.css";
import "./content-page.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_LINKS } from "@/content/site";
import { Mark } from "./brand";
import { CtaLink } from "./cta-link";
import type { LandingEvents } from "@/lib/analytics";

type CtaLocation = LandingEvents["cta_click"]["location"];

export interface Crumb {
  href?: string;
  label: string;
}

const NAV = [
  { href: "/strumenti/zainetto-fiscale", label: "Calcolatori" },
  { href: "/guide/zainetto-fiscale", label: "Guide" },
  { href: "/funzioni/investimenti", label: "Funzioni" },
] as const;

/** Cornice delle pagine di contenuto (calcolatori, guide, funzioni): intestazione col marchio, briciole, corpo e invito finale. */
export function ContentPage({ crumbs, children, ctaTitle, ctaText, ctaLocation }: { crumbs: readonly Crumb[]; children: ReactNode; ctaTitle: string; ctaText: string; ctaLocation: CtaLocation }) {
  return (
    <>
      <header className="legal-bar">
        <div className="wrap">
          <Link href="/" className="legal-brand" aria-label="BuddyBudget, torna alla home">
            <Mark />
            <span>BuddyBudget</span>
          </Link>
          <nav aria-label="Sezioni del sito">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="cp">
        <div className="wrap cp-wrap">
          <nav className="cp-crumbs" aria-label="Percorso">
            {crumbs.map((c, i) => (
              <span key={c.label}>{c.href ? <Link href={c.href}>{c.label}</Link> : c.label}{i < crumbs.length - 1 ? " / " : ""}</span>
            ))}
          </nav>
          {children}
          <aside className="cp-cta">
            <h2>{ctaTitle}</h2>
            <p>{ctaText}</p>
            <CtaLink className="btn main" href={APP_LINKS.signup} location={ctaLocation} target="signup">Prova gratis</CtaLink>
          </aside>
        </div>
      </main>
    </>
  );
}
