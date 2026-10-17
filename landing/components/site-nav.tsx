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

/** Width (px) from which the links fit in the bar; below, they open from the menu button (aligned with `site-nav.css`). */
const NAV_MOBILE_BREAKPOINT = 1000;

/** Labels of the two buttons, the same on every page and in the phone bar of the home. */
const SIGNUP_LABEL = "Inizia gratis";
const LOGIN_LABEL = "Entra";

export interface NavLink {
  href: string;
  label: string;
}

/** One menu for the whole site: absolute paths, so it works the same from the home and from the inner pages. */
export const DEFAULT_NAV_LINKS: readonly NavLink[] = [
  { href: CONTENT_PATHS.funzioni, label: "Funzioni" },
  { href: CONTENT_PATHS.schermate, label: "Schermate" },
  { href: CONTENT_PATHS.strumenti, label: "Calcolatori" },
  { href: CONTENT_PATHS.sicurezza, label: "Sicurezza" },
];

/**
 * Top bar, the same on every page and like the app's top bar: light, a rule below, it scrolls away with the page.
 * On the phone the links live in a full-screen sheet with big rows and the two buttons. With the public repository
 * it also shows «Codice aperto». `current` highlights the entry of the open page.
 */
export function SiteNav({ links = DEFAULT_NAV_LINKS, current }: { links?: readonly NavLink[]; current?: string }) {
  const [open, setOpen] = useState(false);

  // Phone menu: closes with Esc and when the window grows wide; while open the page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const wide = window.matchMedia(`(min-width: ${NAV_MOBILE_BREAKPOINT}px)`);
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const sourceLink = (location: "sezione" | "footer") =>
    SOURCE_URL ? (
      <SourceLink className="gh" href={SOURCE_URL} location={location}>
        <GithubMark />
        Codice aperto
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
          {sourceLink("sezione")}
        </nav>
        <div className="nr">
          <ThemeToggle />
          <CtaLink className="btn ghost" href={APP_LINKS.login} location="nav" target="login">{LOGIN_LABEL}</CtaLink>
          <CtaLink className="btn main" href={APP_LINKS.signup} location="nav" target="signup">{SIGNUP_LABEL}</CtaLink>
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
          {sourceLink("sezione")}
          <div className="menu-acts">
            <CtaLink className="btn main" href={APP_LINKS.signup} location="nav" target="signup" arrow>{SIGNUP_LABEL}</CtaLink>
            <CtaLink className="btn ghost" href={APP_LINKS.login} location="nav" target="login">{LOGIN_LABEL}</CtaLink>
          </div>
          <div className="menu-foot">
            <span>Tema chiaro o scuro</span>
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
}
