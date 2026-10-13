"use client";
import { useLocalization } from "@/lib/localization/provider";

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
import { motion } from "motion/react";

import type { NavBadge, NavItem } from "@/components/layout/sidebar";
import { usePendingNavHref } from "@/components/layout/use-pending-nav";
import { SPRING_SNAPPY } from "@/lib/motion/springs";
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

/** Pillola della voce attiva: una sola, che scivola da una scheda all'altra (`layoutId`). */
function ActivePill() {
  return (
    <motion.span
      layoutId="bottom-nav-pill"
      transition={SPRING_SNAPPY}
      className="absolute inset-0 rounded-full bg-sidebar-primary/15"
      aria-hidden="true"
    />
  );
}

const TAB_CLASS = "relative flex flex-1 flex-col items-center gap-0.5 pt-1.5 text-[11px] font-medium transition-colors";

export function BottomNav({ items, primaryHrefs = BOTTOM_NAV_HREFS, activeHref, badges, onOpenMore, onTabClick }: BottomNavProps) {
  const { t: tr } = useLocalization();
  const pathname = usePathname();
  const [pendingHref, startNav] = usePendingNavHref();
  const primary = primaryHrefs.flatMap((href) => items.filter((i) => i.href === href && !i.comingSoon));
  const current = pendingHref ?? activeHref ?? pathname;
  const inPrimary = primary.some((i) => isActivePath(current, i.href));

  return (
    <nav
      aria-label={tr("Navigazione principale")}
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
            onClick={() => {
              startNav(item.href);
              onTabClick?.(item.href);
            }}
            className={cn(TAB_CLASS, active ? "text-sidebar-foreground" : "text-sidebar-foreground/60")}
          >
            <span
              className={cn(
                "relative flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200",
                active && "text-sidebar-primary"
              )}
            >
              {active ? <ActivePill /> : null}
              <Icon className="relative z-10 size-5" aria-hidden="true" />
              {showBadge ? (
                <span
                  aria-label={tr(badge.ariaLabel)}
                  className="absolute -top-1 right-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-bold leading-none text-sidebar-primary-foreground tabular-nums ring-2 ring-sidebar"
                >
                  {badge.countLabel ?? badge.count}
                </span>
              ) : null}
            </span>
            <span className="leading-none">{tr(item.label)}</span>
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
            "relative flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200",
            !inPrimary && "text-sidebar-primary"
          )}
        >
          {!inPrimary ? <ActivePill /> : null}
          <MoreHorizontal className="relative z-10 size-5" aria-hidden="true" />
        </span>
        <span className="leading-none">{MORE_LABEL}</span>
      </button>
    </nav>
  );
}
