"use client";

/**
 * Viste di una sezione come link veri (ogni vista ha il suo URL), da `lg` in su: un controllo segmentato con il fondo
 * della vista attiva che scivola. Sotto `lg` non mostra nulla: le viste si scelgono dal titolo (`SectionHeading`), che
 * apre un foglio dal basso. La prima voce è la radice: le altre restano attive anche sulle loro sotto-pagine.
 */

import type { LucideIcon } from "lucide-react";
import { SectionTabsSegmented } from "./section-tabs-segmented";

export interface SectionTab {
  href: string;
  label: string;
  /** Icona decorativa prima dell'etichetta (facoltativa). */
  icon?: LucideIcon;
  /** Riga di spiegazione mostrata nel foglio delle viste su telefono (facoltativa). */
  description?: string;
}

export interface SectionTabsProps {
  tabs: readonly SectionTab[];
  activeHref: string;
  /** Etichetta accessibile della navigazione. */
  ariaLabel: string;
}

/** True sull'indirizzo della vista e, tranne per la radice, sulle sue sotto-pagine. */
export function isSectionTabActive(tabHref: string, pathname: string, rootHref: string): boolean {
  if (pathname === tabHref) return true;
  return tabHref !== rootHref && pathname.startsWith(`${tabHref}/`);
}

/** Indice della vista attiva (0 se nessuna corrisponde). */
export function activeSectionTabIndex(tabs: readonly SectionTab[], pathname: string): number {
  const rootHref = tabs[0]?.href ?? "";
  const index = tabs.findIndex((tab) => isSectionTabActive(tab.href, pathname, rootHref));
  return index < 0 ? 0 : index;
}

export function SectionTabs({ tabs, activeHref, ariaLabel }: SectionTabsProps) {
  const activeIndex = activeSectionTabIndex(tabs, activeHref);
  return (
    <div className="hidden lg:block">
      <SectionTabsSegmented tabs={tabs} activeIndex={activeIndex} ariaLabel={ariaLabel} />
    </div>
  );
}
