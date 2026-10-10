"use client";

/**
 * Schede di Investimenti come link veri (ogni scheda ha il suo URL): le stesse `SectionTabs` delle altre sezioni, con le
 * schede di Investimenti come default. Ogni scheda può avere una piccola icona decorativa prima dell'etichetta.
 */

import { ArrowLeftRight, ChartPie, HandCoins, Landmark, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { SectionTabs } from "@/components/domain/shared";

export interface InvestmentsTab {
  href: string;
  label: string;
  /** Icona decorativa prima dell'etichetta (facoltativa). */
  icon?: LucideIcon;
  /** Riga di spiegazione nel menu su mobile (facoltativa). */
  description?: string;
}

/** Schede di default: una per tema, la prima con solo l'essenziale. */
export const INVESTMENTS_TABS: readonly InvestmentsTab[] = [
  { href: "/investimenti", label: "Portafoglio", icon: Wallet, description: "Valore, andamento e posizioni" },
  { href: "/investimenti/performance", label: "Performance", icon: TrendingUp, description: "Rendimento, rischio e confronto" },
  { href: "/investimenti/diversificazione", label: "Diversificazione", icon: ChartPie, description: "Come è distribuito il portafoglio" },
  { href: "/investimenti/proventi", label: "Dividendi", icon: HandCoins, description: "Cedole e proventi incassati" },
  { href: "/investimenti/tasse", label: "Tasse", icon: Landmark, description: "Stime fiscali e minusvalenze" },
  { href: "/investimenti/operazioni", label: "Operazioni", icon: ArrowLeftRight, description: "Acquisti, vendite e importazioni" },
];

/** Dimensione delle icone delle schede, in pixel: piccole, per non competere con il testo. */
export const INVESTMENTS_TAB_ICON_SIZE = 14;

export interface InvestmentsTabsProps {
  activeHref: string;
  tabs?: readonly InvestmentsTab[];
}

export function InvestmentsTabs({ activeHref, tabs = INVESTMENTS_TABS }: InvestmentsTabsProps) {
  return <SectionTabs tabs={tabs} activeHref={activeHref} ariaLabel="Sezioni di Investimenti" />;
}
