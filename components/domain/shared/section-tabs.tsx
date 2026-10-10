"use client";

/**
 * Schede di una sezione come link veri (ogni scheda ha il suo URL), con la scheda attiva evidenziata e portata in vista
 * su mobile. La prima scheda è la radice: le altre restano attive anche sulle loro sotto-pagine. La linea sotto la
 * scheda attiva scivola con una molla quando si cambia scheda.
 */

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { SPRING_BOUNCY } from "@/lib/motion/springs";
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
  const indicatorId = `section-tab-${ariaLabel}`;
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
                  "relative -mb-px inline-flex min-h-10 items-center gap-1.5 px-3 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? (
                  <motion.span
                    layoutId={indicatorId}
                    transition={SPRING_BOUNCY}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
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
