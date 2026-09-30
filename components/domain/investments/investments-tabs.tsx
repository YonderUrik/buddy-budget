"use client";

/** Schede di Investimenti come link veri (ogni scheda ha il suo URL), con la scheda attiva evidenziata. */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface InvestmentsTab {
  href: string;
  label: string;
}

/** Schede di default: una per tema, la prima con solo l'essenziale. */
export const INVESTMENTS_TABS: readonly InvestmentsTab[] = [
  { href: "/investimenti", label: "Portafoglio" },
  { href: "/investimenti/performance", label: "Performance" },
  { href: "/investimenti/diversificazione", label: "Diversificazione" },
  { href: "/investimenti/proventi", label: "Proventi" },
  { href: "/investimenti/tasse", label: "Tasse" },
  { href: "/investimenti/operazioni", label: "Operazioni" },
];

export interface InvestmentsTabsProps {
  activeHref: string;
  tabs?: readonly InvestmentsTab[];
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
          const active = tab.href === activeHref;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
