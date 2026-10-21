/**
 * Texts of the site chrome (bar, footer, frame of the content pages, language switch) in each language. The page
 * texts live in their own content files (`home.ts`, `en/home.ts`, `security.ts`, `en/security.ts`…).
 */
import type { Locale } from "@/lib/i18n";
import { LEGAL_PATHS } from "./legal";
import { EN_PATHS } from "./locales";
import { CONTENT_PATHS } from "./seo-pages";

export interface NavLink {
  href: string;
  label: string;
}

export interface UiText {
  nav: {
    /** One menu for the whole site: absolute paths, so it works the same from the home and from the inner pages. */
    links: readonly NavLink[];
    signup: string;
    login: string;
    menuOpen: string;
    menuClose: string;
    /** `aria-label` of the link lists. */
    sections: string;
    /** Row with the theme toggle at the bottom of the phone menu. */
    theme: string;
    /** `aria-label` of the brand link. */
    home: string;
    source: string;
  };
  themeToggle: string;
  footer: {
    links: readonly NavLink[];
    pages: string;
    other: string;
    status: string;
  };
  /** `aria-label` of the language menu. */
  language: string;
  content: {
    /** Main button of the closing of every content page (the same as the home). */
    cta: string;
    demo: string;
    /** Back link label when the parent is the home. */
    home: string;
    disclaimerStrong: string;
    disclaimer: string;
  };
  sources: {
    summary: string;
    checked: string;
    note: string;
  };
}

export const UI: Record<Locale, UiText> = {
  it: {
    nav: {
      links: [
        { href: CONTENT_PATHS.funzioni, label: "Funzioni" },
        { href: CONTENT_PATHS.schermate, label: "Schermate" },
        { href: CONTENT_PATHS.strumenti, label: "Calcolatori" },
        { href: CONTENT_PATHS.sicurezza, label: "Sicurezza" },
        { href: "/#prezzi", label: "Prezzi" },
      ],
      signup: "Inizia gratis",
      login: "Entra",
      menuOpen: "Apri il menu",
      menuClose: "Chiudi il menu",
      sections: "Sezioni",
      theme: "Tema chiaro o scuro",
      home: "BuddyBudget, home",
      source: "Codice aperto",
    },
    themeToggle: "Cambia tema",
    footer: {
      links: [
        { href: CONTENT_PATHS.funzioni, label: "Funzioni" },
        { href: CONTENT_PATHS.schermate, label: "Schermate" },
        { href: CONTENT_PATHS.strumenti, label: "Calcolatori" },
        { href: CONTENT_PATHS.sicurezza, label: "Sicurezza" },
        { href: LEGAL_PATHS.privacy, label: "Privacy" },
        { href: LEGAL_PATHS.termini, label: "Termini" },
        { href: LEGAL_PATHS.cookie, label: "Cookie" },
      ],
      pages: "Pagine del sito",
      other: "Codice, stato e supporto",
      status: "Stato del servizio",
    },
    language: "Lingua",
    content: {
      cta: "Inizia gratis",
      demo: "Prova la demo",
      home: "Home",
      disclaimerStrong: "Solo a scopo informativo.",
      disclaimer: "I calcoli sono stime semplificate e i testi riassumono norme che cambiano: non sono consulenza fiscale né un riferimento assoluto. Verifica sempre con il tuo intermediario, la normativa in vigore o un consulente.",
    },
    sources: {
      summary: "Fonti e riferimenti normativi",
      checked: "Fonti controllate il",
      note: "Le norme cambiano: verifica sempre la versione in vigore o chiedi a un consulente.",
    },
  },
  en: {
    nav: {
      links: [
        { href: EN_PATHS.features, label: "Features" },
        { href: EN_PATHS.screens, label: "Screens" },
        { href: EN_PATHS.security, label: "Security" },
        { href: `${EN_PATHS.home}#pricing`, label: "Pricing" },
      ],
      signup: "Get started free",
      login: "Sign in",
      menuOpen: "Open the menu",
      menuClose: "Close the menu",
      sections: "Sections",
      theme: "Light or dark theme",
      home: "BuddyBudget, home",
      source: "Open source",
    },
    themeToggle: "Switch theme",
    footer: {
      links: [
        { href: EN_PATHS.features, label: "Features" },
        { href: EN_PATHS.screens, label: "Screens" },
        { href: EN_PATHS.security, label: "Security" },
        { href: EN_PATHS.calculators, label: "Calculators" },
        { href: EN_PATHS.privacy, label: "Privacy" },
        { href: EN_PATHS.terms, label: "Terms" },
        { href: EN_PATHS.cookies, label: "Cookies" },
      ],
      pages: "Site pages",
      other: "Code, status and support",
      status: "Service status",
    },
    language: "Language",
    content: {
      cta: "Get started free",
      demo: "Try the demo",
      home: "Home",
      disclaimerStrong: "For information only.",
      disclaimer: "The calculations are simplified estimates and the texts summarise rules that change: they are not tax advice. Always check with your broker, the rules in force or an adviser.",
    },
    sources: {
      summary: "Sources and legal references",
      checked: "Sources checked on",
      note: "Rules change: always check the version in force or ask an adviser.",
    },
  },
};
