/**
 * Presentazione delle aree nella pagina «Tutte le funzioni»: icona (la stessa della sidebar dell'app), una frase
 * d'introduzione, una schermata vera e un eventuale approfondimento. Le funzioni vere e proprie
 * vengono dal catalogo condiviso (`catalog.generated.ts`): qui c'è solo il contorno.
 */
import type { Locale } from "@/lib/i18n";
import { FEATURE_AREA_LABELS_EN, type FeatureArea } from "./catalog.generated";
import type { HomeIcon } from "./home";
import { EN_PATHS } from "./locales";
import type { ScreenId } from "./screens";
import { CONTENT_PATHS } from "./seo-pages";

export interface AreaMeta {
  /** Name of the area in the page language. */
  name: string;
  /** Ancora della sezione (`/funzioni#liquidita`). */
  slug: string;
  icon: HomeIcon;
  intro: string;
  shot?: { id: ScreenId };
  more?: { href: string; label: string };
}

export const AREA_META: Record<FeatureArea, AreaMeta> = {
  Liquidità: {
    name: "Liquidità",
    slug: "liquidita",
    icon: "wallet",
    intro: "Conti collegati in sola lettura o tenuti a mano, movimenti con la categoria giusta e le spese divise nei quattro gruppi.",
    shot: { id: "movimenti" },
  },
  Investimenti: {
    name: "Investimenti",
    slug: "investimenti",
    icon: "trending",
    intro: "Il rendimento calcolato dalle tue operazioni, il confronto con un indice, il rischio e le tasse secondo le regole italiane.",
    shot: { id: "investimenti" },
    more: { href: CONTENT_PATHS.funzioneInvestimenti, label: "Gli investimenti nel dettaglio" },
  },
  Debiti: {
    name: "Debiti",
    slug: "debiti",
    icon: "card",
    intro: "Mutui e finanziamenti con il piano delle rate, il TAEG e la simulazione di un'estinzione anticipata.",
    shot: { id: "debiti" },
    more: { href: CONTENT_PATHS.ammortamento, label: "Calcolatore della rata" },
  },
  Patrimonio: {
    name: "Patrimonio",
    slug: "patrimonio",
    icon: "dashboard",
    intro: "Il quadro d'insieme: il patrimonio netto giorno per giorno, il fondo pensione e l'anno in cui puoi smettere di lavorare.",
    shot: { id: "panoramica" },
  },
  Account: {
    name: "Account",
    slug: "account",
    icon: "shield",
    intro: "Accesso senza password, i dati che esporti quando vuoi e un'app che si installa sul telefono.",
  },
};

/** The same areas on the English features page (`/en/features`), with English anchors. */
export const AREA_META_EN: Record<FeatureArea, AreaMeta> = {
  Liquidità: {
    name: FEATURE_AREA_LABELS_EN.Liquidità,
    slug: "cash",
    icon: "wallet",
    intro: "Accounts connected read-only or kept by hand, transactions with the right category, and spending split into four groups.",
    shot: { id: "movimenti" },
  },
  Investimenti: {
    name: FEATURE_AREA_LABELS_EN.Investimenti,
    slug: "investments",
    icon: "trending",
    intro: "Returns worked out from your own trades, a comparison with an index, risk, and taxes under the Italian rules (partly for Germany).",
    shot: { id: "investimenti" },
    more: { href: EN_PATHS.featureInvestments, label: "Investments in detail" },
  },
  Debiti: {
    name: FEATURE_AREA_LABELS_EN.Debiti,
    slug: "debts",
    icon: "card",
    intro: "Mortgages and loans with the payment schedule, the APR and what an early repayment would change.",
    shot: { id: "debiti" },
    more: { href: EN_PATHS.loanAmortization, label: "Loan calculator" },
  },
  Patrimonio: {
    name: FEATURE_AREA_LABELS_EN.Patrimonio,
    slug: "net-worth",
    icon: "dashboard",
    intro: "The whole picture: net worth day by day, the pension fund and the year you could stop working.",
    shot: { id: "panoramica" },
  },
  Account: {
    name: FEATURE_AREA_LABELS_EN.Account,
    slug: "account",
    icon: "shield",
    intro: "Sign-in without a password, your data exported whenever you like, and an app you can install on your phone.",
  },
};

/** Area presentation in the page language. */
export function areaMeta(locale: Locale): Record<FeatureArea, AreaMeta> {
  return locale === "en" ? AREA_META_EN : AREA_META;
}
