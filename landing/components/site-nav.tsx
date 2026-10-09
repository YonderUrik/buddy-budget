"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "./site-nav.css";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { APP_LINKS } from "@/content/site";
import { Mark } from "./brand";
import { CtaLink } from "./cta-link";
import { ThemeToggle } from "./theme-toggle";

/** Scroll (px) oltre il quale la nav prende lo sfondo sfocato. */
const NAV_SCROLLED_AT = 20;

export interface NavLink {
  href: string;
  label: string;
}

/** Un solo menu per tutto il sito: indirizzi assoluti, così funziona uguale dalla home e dalle pagine interne. */
export const DEFAULT_NAV_LINKS: readonly NavLink[] = [
  { href: CONTENT_PATHS.funzioni, label: "Funzioni" },
  { href: "/#italia", label: "Tasse italiane" },
  { href: CONTENT_PATHS.zainetto, label: "Calcolatori" },
  { href: CONTENT_PATHS.schermate, label: "Schermate" },
  { href: "/#sicurezza", label: "Sicurezza" },
];

/** Barra fissa in alto, la stessa in ogni pagina. Passa allo stile scuro quando sta sopra una sezione `data-nav-dark`; `current` evidenzia la voce della pagina aperta. */
export function SiteNav({ links = DEFAULT_NAV_LINKS, current }: { links?: readonly NavLink[]; current?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > NAV_SCROLLED_AT);
      const probe = (ref.current?.offsetHeight ?? 68) / 2;
      const over = Array.from(document.querySelectorAll("[data-nav-dark]")).some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= probe && r.bottom >= probe;
      });
      setDark(over);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <header ref={ref} className={`nav${scrolled ? " sc" : ""}${dark ? " dk" : ""}`}>
      <div className="wrap">
        <Link className="brand" href="/" aria-label="BuddyBudget, home">
          <Mark />
          BuddyBudget
        </Link>
        <nav className="links" aria-label="Sezioni">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>
        <div className="nr">
          <ThemeToggle />
          <CtaLink className="btn ghost" href={APP_LINKS.login} location="nav" target="login">Accedi</CtaLink>
          <CtaLink className="btn main" href={APP_LINKS.signup} location="nav" target="signup">Crea un account</CtaLink>
        </div>
      </div>
    </header>
  );
}
