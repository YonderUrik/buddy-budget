"use client";

/**
 * What Movimenti, Analisi and Abbonamenti show before the first account: what the tab will hold and the one action
 * that starts it, instead of zero amounts and empty charts.
 */

import { ArrowLeftRightIcon, BarChart3, Repeat, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { LIQUIDITY_HREF } from "./liquidity-nav";

/** Tabs that need an account to show anything, with their texts (Italian source strings, translated by `EmptyState`). */
export const NO_ACCOUNT_TABS: Record<string, { icon: LucideIcon; title: string; description: string }> = {
  [LIQUIDITY_HREF]: {
    icon: ArrowLeftRightIcon,
    title: "Prima serve un conto",
    description: "Crea un conto a mano o importa l'estratto conto: qui vedrai entrate e uscite, giorno per giorno.",
  },
  [`${LIQUIDITY_HREF}/analisi`]: {
    icon: BarChart3,
    title: "Qui vedrai dove vanno i soldi",
    description: "Spese per categoria mese per mese, entrate e risparmio. Serve un conto con i suoi movimenti.",
  },
  [`${LIQUIDITY_HREF}/abbonamenti`]: {
    icon: Repeat,
    title: "Qui troverai i tuoi abbonamenti",
    description: "Li cerchiamo da soli nei movimenti di un conto: quanto costano al mese e all'anno, e quando arriva il prossimo addebito.",
  },
};

export interface LiquidityNoAccountsProps {
  /** Current tab (one of `NO_ACCOUNT_TABS`). */
  href: string;
  onAddAccount: () => void;
  importHref?: string;
}

export function LiquidityNoAccounts({ href, onAddAccount, importHref = "/importazioni" }: LiquidityNoAccountsProps) {
  const tab = NO_ACCOUNT_TABS[href] ?? NO_ACCOUNT_TABS[LIQUIDITY_HREF];
  const name = href === LIQUIDITY_HREF ? "movimenti" : href.endsWith("/analisi") ? "analisi" : "abbonamenti";
  return (
    <EmptyState
      icon={tab.icon}
      title={tab.title}
      description={tab.description}
      primary={{ label: "Aggiungi un conto", onClick: () => { track("empty_state_action_clicked", { area: name, action: "conto" }); onAddAccount(); } }}
      secondary={{ label: "Importa un file", href: importHref, onClick: () => track("empty_state_action_clicked", { area: name, action: "import" }) }}
      className="pt-4"
    />
  );
}
