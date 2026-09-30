"use client";

/**
 * Schede di una sezione come link veri (ogni scheda ha il suo URL), con la scheda attiva evidenziata e portata in vista
 * su mobile. La prima scheda è la radice: le altre restano attive anche sulle loro sotto-pagine.
 */

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionTab {
  href: string;
  label: string;
  /** Icona decorativa prima dell'etichetta (facoltativa). */
  icon?: LucideIcon;
}

export interface SectionTabsProps {
  tabs: readonly SectionTab[];
  activeHref: string;
  /** Etichetta accessibile della navigazione. */
  ariaLabel: string;
}

const SECTION_TAB_ICON_SIZE = 14;

/** True sull'indirizzo della scheda e, tranne per la radice, sulle sue sotto-pagine. */
export function isSectionTabActive(tabHref: string, pathname: string, rootHref: string): boolean {
  if (pathname === tabHref) return true;
  return tabHref !== rootHref && pathname.startsWith(`${tabHref}/`);
}

export function SectionTabs({ tabs, activeHref, ariaLabel }: SectionTabsProps) {
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeHref]);
  const rootHref = tabs[0]?.href ?? "";
  return (
    <nav aria-label={ariaLabel} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 border-b sm:w-full">
        {tabs.map((tab) => {
          const active = isSectionTabActive(tab.href, activeHref, rootHref);
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
                    size={SECTION_TAB_ICON_SIZE}
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
