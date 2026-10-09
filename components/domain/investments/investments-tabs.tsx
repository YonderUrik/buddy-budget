"use client";

/**
 * Schede di Investimenti come link veri (ogni scheda ha il suo URL), con la scheda attiva evidenziata. Ogni scheda può
 * avere una piccola icona prima dell'etichetta: decorativa, il nome resta il testo del link.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, ChartPie, HandCoins, Landmark, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InvestmentsTab {
  href: string;
  label: string;
  /** Icona decorativa prima dell'etichetta (facoltativa). */
  icon?: LucideIcon;
}

/** Schede di default: una per tema, la prima con solo l'essenziale. */
export const INVESTMENTS_TABS: readonly InvestmentsTab[] = [
  { href: "/investimenti", label: "Portafoglio", icon: Wallet },
  { href: "/investimenti/performance", label: "Performance", icon: TrendingUp },
  { href: "/investimenti/diversificazione", label: "Diversificazione", icon: ChartPie },
  { href: "/investimenti/proventi", label: "Dividendi", icon: HandCoins },
  { href: "/investimenti/tasse", label: "Tasse", icon: Landmark },
  { href: "/investimenti/operazioni", label: "Operazioni", icon: ArrowLeftRight },
];

/** Dimensione delle icone delle schede, in pixel: piccole, per non competere con il testo. */
export const INVESTMENTS_TAB_ICON_SIZE = 14;

export interface InvestmentsTabsProps {
  activeHref: string;
  tabs?: readonly InvestmentsTab[];
}

/** Una scheda è attiva sul suo indirizzo e sulle sue sotto-pagine (es. la pagina di un titolo), tranne la prima che è la radice. */
export function isTabActive(tabHref: string, pathname: string, rootHref: string = INVESTMENTS_TABS[0].href): boolean {
  if (pathname === tabHref) return true;
  return tabHref !== rootHref && pathname.startsWith(`${tabHref}/`);
}

export function InvestmentsTabs({ activeHref, tabs = INVESTMENTS_TABS }: InvestmentsTabsProps) {
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  // Su mobile le schede scorrono: la scheda attiva va portata in vista (es. aprendo direttamente /investimenti/tasse).
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeHref]);
  return (
    <nav aria-label="Sezioni di Investimenti" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 border-b sm:w-full">
        {tabs.map((tab) => {
          const active = isTabActive(tab.href, activeHref);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {Icon ? (
                  <Icon
                    size={INVESTMENTS_TAB_ICON_SIZE}
                    aria-hidden="true"
                    className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground/70")}
                  />
                ) : null}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
