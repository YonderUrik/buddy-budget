"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import "./site-nav.css";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { APP_LINKS, SOURCE_URL } from "@/content/site";
import { Mark } from "./brand";
import { CtaLink } from "./cta-link";
import { GithubMark } from "./github-mark";
import { SourceLink } from "./source-link";
import { ThemeToggle } from "./theme-toggle";

/** Larghezza (px) da cui le voci stanno nella barra; sotto si aprono dal pulsante menu (allineata a `site-nav.css`). */
const NAV_MOBILE_BREAKPOINT = 1000;

export interface NavLink {
  href: string;
  label: string;
}

/** Un solo menu per tutto il sito: indirizzi assoluti, così funziona uguale dalla home e dalle pagine interne. */
export const DEFAULT_NAV_LINKS: readonly NavLink[] = [
  { href: "/#storia", label: "Le sei domande" },
  { href: CONTENT_PATHS.funzioni, label: "Funzioni" },
  { href: CONTENT_PATHS.strumenti, label: "Calcolatori" },
  { href: CONTENT_PATHS.sicurezza, label: "Sicurezza" },
];

/**
 * Barra in alto, la stessa in ogni pagina e come la topbar dell'app: chiara, con una riga sotto, scorre via con la
 * pagina (niente barre appiccicose). Con il repository pubblico mostra anche «Open source». `current` evidenzia la voce della pagina aperta.
 */
export function SiteNav({ links = DEFAULT_NAV_LINKS, current }: { links?: readonly NavLink[]; current?: string }) {
  const [open, setOpen] = useState(false);

  // Menu da telefono: si chiude con Esc e quando la finestra torna larga.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const wide = window.matchMedia(`(min-width: ${NAV_MOBILE_BREAKPOINT}px)`);
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const sourceLink = SOURCE_URL ? (
    <SourceLink className="gh" href={SOURCE_URL} location="sezione">
      <GithubMark />
      Open source
    </SourceLink>
  ) : null;

  return (
    <header className={`nav${open ? " open" : ""}`}>
      <div className="wrap">
        <Link className="brand" href="/" aria-label="BuddyBudget, home">
          <Mark />
          BuddyBudget
        </Link>
        <nav className="links" aria-label="Sezioni">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>{l.label}</Link>
          ))}
          {sourceLink}
        </nav>
        <div className="nr">
          <ThemeToggle />
          <CtaLink className="btn ghost" href={APP_LINKS.login} location="nav" target="login">Accedi</CtaLink>
          <CtaLink className="btn main" href={APP_LINKS.signup} location="nav" target="signup">Crea un account</CtaLink>
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="nav-menu" aria-label={open ? "Chiudi il menu" : "Apri il menu"} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={20} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="nav-menu" className="menu" aria-label="Sezioni" hidden={!open}>
        <div className="wrap">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          {sourceLink}
          <div className="menu-foot">
            <CtaLink className="menu-login" href={APP_LINKS.login} location="nav" target="login">Accedi</CtaLink>
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
}
