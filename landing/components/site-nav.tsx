"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./site-nav.css";
import { HOME_PATH, languageHrefs } from "@/content/locales";
import { LOCALE_APP_LINKS, SOURCE_URL } from "@/content/site";
import { UI, type NavLink } from "@/content/ui";
import type { Locale } from "@/lib/i18n";
import { useFieldUnderBar } from "@/lib/use-field-under-bar";
import { Mark } from "./brand";
import { CtaLink } from "./cta-link";
import { GithubMark } from "./github-mark";
import { LangSwitch } from "./lang-switch";
import { SourceLink } from "./source-link";
import { ThemeToggle } from "./theme-toggle";

export type { NavLink } from "@/content/ui";

/** Width (px) from which the links fit in the bar; below, they open from the menu button (aligned with `site-nav.css`). */
const NAV_MOBILE_BREAKPOINT = 1000;

export type NavTone = "light" | "navy";

/** The Italian menu (kept as a named export for callers that pass their own list). */
export const DEFAULT_NAV_LINKS: readonly NavLink[] = UI.it.nav.links;

export interface SiteNavProps {
  /** Menu entries; default: the menu of `locale`. */
  links?: readonly NavLink[];
  /** Path of the menu entry to highlight. */
  current?: string;
  tone?: NavTone;
  locale?: Locale;
  /** Target of the language menu for the other language; default: the counterpart of `current`, or its home. */
  alternate?: string;
}

/**
 * Top bar, the same on every page: it stays at the top and takes the colours of the field under it (taste-skill
 * «Colour by chapter»: navy on the opening, yellow on the tax section, light on the rest), with a 300 ms change.
 * On the phone the links live in a full-screen sheet with big rows, the two buttons and the language switch. With
 * the public repository it also shows the open-source link. `current` highlights the entry of the open page. `tone`
 * is the field before the page is measured (every page opens on navy). Texts come from `UI[locale]`.
 */
export function SiteNav({ links, current, tone = "navy", locale = "it", alternate }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const field = useFieldUnderBar(bar, tone === "navy" ? "navy" : "light");
  const t = UI[locale];
  const items = links ?? t.nav.links;
  const app = LOCALE_APP_LINKS[locale];
  const langHrefs = languageHrefs(locale, current, alternate);

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
        {t.nav.source}
      </SourceLink>
    ) : null;

  return (
    <header ref={bar} className={`nav${open ? " open" : ""}`} data-on={open ? "navy" : field}>
      <div className="wrap">
        <Link className="brand" href={HOME_PATH[locale]} aria-label={t.nav.home}>
          <Mark />
          BuddyBudget
        </Link>
        <nav className="links" aria-label={t.nav.sections}>
          {items.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>{l.label}</Link>
          ))}
          {sourceLink("sezione")}
        </nav>
        <div className="nr">
          <LangSwitch className="nav-lang" locale={locale} hrefs={langHrefs} location="nav" label={t.language} />
          <ThemeToggle label={t.themeToggle} />
          <CtaLink className="btn line" href={app.login} location="nav" target="login" lang={locale}>{t.nav.login}</CtaLink>
          <CtaLink className="btn sun" href={app.signup} location="nav" target="signup" lang={locale}>{t.nav.signup}</CtaLink>
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="nav-menu" aria-label={open ? t.nav.menuClose : t.nav.menuOpen} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={20} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="nav-menu" className="menu" aria-label={t.nav.sections} hidden={!open}>
        <div className="wrap">
          {items.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          {sourceLink("sezione")}
          <div className="menu-acts">
            <CtaLink className="btn sun" href={app.signup} location="nav" target="signup" lang={locale} arrow>{t.nav.signup}</CtaLink>
            <CtaLink className="btn line" href={app.login} location="nav" target="login" lang={locale}>{t.nav.login}</CtaLink>
          </div>
          <div className="menu-foot">
            <span>{t.language}</span>
            <LangSwitch locale={locale} hrefs={langHrefs} location="menu" label={t.language} up />
          </div>
          <div className="menu-foot">
            <span>{t.nav.theme}</span>
            <ThemeToggle label={t.themeToggle} />
          </div>
        </div>
      </nav>
    </header>
  );
}
