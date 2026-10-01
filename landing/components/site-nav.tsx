"use client";

import { useEffect, useRef, useState } from "react";
import "./site-nav.css";
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

export const DEFAULT_NAV_LINKS: readonly NavLink[] = [
  { href: "#prodotto", label: "Prodotto" },
  { href: "#schermate", label: "Schermate" },
  { href: "#funzioni", label: "Funzioni" },
  { href: "#perche", label: "Perché" },
  { href: "#chi", label: "Chi siamo" },
];

/** Barra fissa in alto. Passa allo stile scuro quando sta sopra una sezione `data-nav-dark`. */
export function SiteNav({ links = DEFAULT_NAV_LINKS }: { links?: readonly NavLink[] }) {
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
        <a className="brand" href="#top">
          <Mark />
          BuddyBudget
        </a>
        <nav className="links" aria-label="Sezioni">
          {links.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
        <div className="nr">
          <ThemeToggle />
          <CtaLink className="btn ghost" href={APP_LINKS.login} location="nav" target="login">Accedi</CtaLink>
          <CtaLink className="btn main" href={APP_LINKS.signup} location="nav" target="signup">Inizia</CtaLink>
        </div>
      </div>
    </header>
  );
}
