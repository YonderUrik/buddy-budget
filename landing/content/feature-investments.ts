/**
 * Texts of the investments feature page in each language (`/funzioni/investimenti`, `/en/features/investments`).
 * The English one links the English calculator and guide.
 */
import type { Locale } from "@/lib/i18n";
import type { HomeIcon } from "./home";
import { SOURCES_CHECKED_EN, SOURCES_EN } from "./en/tools";
import { EN_PATHS } from "./locales";
import { CONTENT_PATHS, SOURCES, SOURCES_CHECKED, type Source } from "./seo-pages";

export interface InvestmentsPageContent {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  kicker: string;
  /** Path from the home: home, features, this page. */
  crumbs: readonly { href?: string; label: string }[];
  ctaTitle: string;
  ctaText: string;
  blocks: readonly { icon: HomeIcon; title: string; text: string }[];
  toolsTitle: string;
  tools: readonly { href: string; title: string; text: string }[];
  sources: readonly Source[];
  sourcesChecked: string;
}

export const INVESTMENTS_IT: InvestmentsPageContent = {
  locale: "it",
  path: CONTENT_PATHS.funzioneInvestimenti,
  title: "Tracciare gli investimenti con le tasse italiane: ETF, azioni, BTP",
  description: "Rendimento vero, confronto con un indice, rischio, diversificazione, zaino fiscale, bollo e imposta di una vendita ipotetica: gli investimenti di BuddyBudget, pensati per le regole italiane.",
  h1: "Investimenti, con le tasse italiane",
  lead: "ETF, azioni, BTP, fondi e crypto in un solo posto, accanto ai tuoi conti e ai tuoi debiti. Il rendimento è calcolato dalle tue operazioni e le tasse seguono le regole italiane.",
  kicker: "Funzioni",
  crumbs: [{ href: "/", label: "BuddyBudget" }, { href: CONTENT_PATHS.funzioni, label: "Funzioni" }, { label: "Investimenti" }],
  ctaTitle: "Prova gli investimenti con i tuoi dati.",
  ctaText: "Aggiungi le operazioni o importa un CSV, e vedi il quadro completo con le tasse già dentro.",
  blocks: [
    { icon: "trending", title: "Rendimento vero", text: "Il rendimento pesato per i tempi dei tuoi versamenti, confrontato con un indice a parità di flussi." },
    { icon: "pie", title: "Rischio e diversificazione", text: "Quanto oscilla il portafoglio e come è distribuito tra strumenti, aree e settori." },
    { icon: "backpack", title: "Fiscalità italiana", text: "Plusvalenze, zaino fiscale a 4 anni e bollo calcolati dalle tue operazioni." },
    { icon: "calculator", title: "Prima di vendere", text: "L'imposta che pagheresti vendendo oggi, anche con le minusvalenze già nello zainetto." },
  ],
  toolsTitle: "Strumenti gratuiti",
  tools: [
    { href: CONTENT_PATHS.zainetto, title: "Calcolatore zainetto fiscale", text: "Minusvalenze, scadenze e imposta su una plusvalenza." },
    { href: CONTENT_PATHS.guidaZainetto, title: "Guida allo zainetto fiscale", text: "Cos'è, come funzionano i 4 anni, con esempi." },
  ],
  sources: [SOURCES.tuir68, SOURCES.circolare19e],
  sourcesChecked: SOURCES_CHECKED,
};

export const INVESTMENTS_EN: InvestmentsPageContent = {
  locale: "en",
  path: EN_PATHS.featureInvestments,
  title: "Track your investments with Italian taxes: ETFs, stocks, government bonds",
  description: "Real returns, comparison with an index, risk, diversification, tax-loss carryforward, stamp duty and the tax on a sale before you make it: BuddyBudget's investments, built around the Italian rules.",
  h1: "Investments, with Italian taxes",
  lead: "ETFs, stocks, government bonds, funds and crypto in one place, next to your accounts and your debts. Returns are worked out from your own trades and the taxes follow the Italian rules; for Germany there are partial 2026 estimates.",
  kicker: "Features",
  crumbs: [{ href: EN_PATHS.home, label: "BuddyBudget" }, { href: EN_PATHS.features, label: "Features" }, { label: "Investments" }],
  ctaTitle: "Try the investments with your own data.",
  ctaText: "Add your trades or import a CSV, and see the whole picture with the taxes already in.",
  blocks: [
    { icon: "trending", title: "Real returns", text: "Your return weighted by when you paid money in, compared with an index fed the same cash flows." },
    { icon: "pie", title: "Risk and diversification", text: "How much the portfolio swings and how it splits across instruments, regions and sectors." },
    { icon: "backpack", title: "Italian taxation", text: "Capital gains, the four-year zainetto fiscale (tax-loss carryforward) and bollo (stamp duty), worked out from your trades." },
    { icon: "calculator", title: "Before you sell", text: "The tax you'd pay if you sold today, counting the losses already in your zainetto." },
  ],
  toolsTitle: "Free tools",
  tools: [
    { href: EN_PATHS.zainetto, title: "Zainetto fiscale calculator", text: "Losses, expiry dates and the tax on a gain." },
    { href: EN_PATHS.guideZainetto, title: "Guide to the zainetto fiscale", text: "What it is and how the four years work, with examples." },
  ],
  sources: [SOURCES_EN.tuir68, SOURCES_EN.circolare19e],
  sourcesChecked: SOURCES_CHECKED_EN,
};
