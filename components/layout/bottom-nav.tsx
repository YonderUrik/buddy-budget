"use client";

/**
 * BottomNav
 *
 * Barra di navigazione in basso, solo su mobile (< 768px). Mostra le voci principali con icona ed etichetta, il badge
 * dei movimenti da sistemare dove serve e un'ultima scheda «Altro» che apre il menu completo (le altre sezioni, il
 * riepilogo, le scadenze e il profilo). «Altro» risulta attiva quando la pagina corrente non è tra le voci mostrate.
 *
 * Riusabilità: voci, badge e voce attiva arrivano da fuori; `primaryHrefs` sceglie quali voci stanno nella barra.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import type { NavBadge, NavItem } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

/** Voci che stanno nella barra: le quattro sezioni più usate, il resto è sotto «Altro». */
export const BOTTOM_NAV_HREFS = ["/panoramica", "/liquidita", "/investimenti", "/debiti"] as const;

/** Etichetta della scheda che apre il menu completo. */
const MORE_LABEL = "Altro";

/** Altezza della barra (rem): serve al contenuto per non finirle sotto. */
export const BOTTOM_NAV_HEIGHT_REM = 4;

export interface BottomNavProps {
  items: NavItem[];
  /** Href delle voci mostrate nella barra, nell'ordine in cui compaiono. */
  primaryHrefs?: readonly string[];
  /** Href della voce attiva; default: ricavato dal percorso corrente. */
  activeHref?: string;
  badges?: Record<string, NavBadge>;
  /** Apre il menu completo («Altro»). */
  onOpenMore: () => void;
  /** Tocco su una scheda (`href` della voce, o «altro»), per le statistiche d'uso. */
  onTabClick?: (key: string) => void;
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const TAB_CLASS = "relative flex flex-1 flex-col items-center gap-0.5 pt-1.5 text-[11px] font-medium transition-colors";

export function BottomNav({ items, primaryHrefs = BOTTOM_NAV_HREFS, activeHref, badges, onOpenMore, onTabClick }: BottomNavProps) {
  const pathname = usePathname();
  const primary = primaryHrefs.flatMap((href) => items.filter((i) => i.href === href && !i.comingSoon));
  const current = activeHref ?? pathname;
  const inPrimary = primary.some((i) => isActivePath(current, i.href));

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ height: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom))` }}
    >
      {primary.map((item) => {
        const active = isActivePath(current, item.href);
        const badge = badges?.[item.href];
        const showBadge = badge !== undefined && badge.count > 0;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => onTabClick?.(item.href)}
            className={cn(TAB_CLASS, active ? "text-sidebar-foreground" : "text-sidebar-foreground/60")}
          >
            <span
              className={cn(
                "relative flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                active && "bg-sidebar-primary/15 text-sidebar-primary"
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {showBadge ? (
                <span
                  aria-label={badge.ariaLabel}
                  className="absolute -top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-bold leading-none text-sidebar-primary-foreground tabular-nums ring-2 ring-sidebar"
                >
                  {badge.countLabel ?? badge.count}
                </span>
              ) : null}
            </span>
            <span className="leading-none">{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => {
          onTabClick?.("altro");
          onOpenMore();
        }}
        aria-haspopup="dialog"
        className={cn(TAB_CLASS, !inPrimary ? "text-sidebar-foreground" : "text-sidebar-foreground/60")}
      >
        <span
          className={cn(
            "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
            !inPrimary && "bg-sidebar-primary/15 text-sidebar-primary"
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </span>
        <span className="leading-none">{MORE_LABEL}</span>
      </button>
    </nav>
  );
}
