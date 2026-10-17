"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * BottomNav
 *
 * Bottom tab bar, phone only (< 768px): a floating rounded capsule inset from the screen edges, like the iOS 26 tab bar,
 * with icon and label per section, the "to sort" badge where needed and a last «Altro» tab that opens the full menu.
 * «Altro» is active when the current page is not one of the tabs.
 *
 * Reusability: items, badges and active item come from outside; `primaryHrefs` picks which items sit in the bar.
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

/** Items shown in the bar: the four most used sections, the rest is under «Altro». */
export const BOTTOM_NAV_HREFS = ["/panoramica", "/liquidita", "/investimenti", "/debiti"] as const;

/** Label of the tab that opens the full menu. */
const MORE_LABEL = "Altro";

/** Height of the floating capsule (rem). */
const BOTTOM_NAV_BAR_REM = 4;
/** Gap between the capsule and the bottom edge (rem), above the home indicator in the app. */
const BOTTOM_NAV_GAP_REM = 0.75;
/** Space the bar takes at the bottom (rem): the content leaves this much room so it never ends up under it. */
export const BOTTOM_NAV_HEIGHT_REM = BOTTOM_NAV_BAR_REM + BOTTOM_NAV_GAP_REM * 2;

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

/** Pill behind the active tab: a single one that slides between tabs (`layoutId`). */
function ActivePill() {
  return (
    <motion.span
      layoutId="bottom-nav-pill"
      transition={SPRING_SNAPPY}
      className="absolute inset-x-0 inset-y-1 rounded-full bg-sidebar-accent"
      aria-hidden="true"
    />
  );
}

const TAB_CLASS = "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors";

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
      className="fixed inset-x-3 z-30 flex rounded-full border border-sidebar-border bg-sidebar/90 px-1 shadow-lg shadow-black/10 supports-backdrop-filter:backdrop-blur-xl md:hidden"
      style={{ height: `${BOTTOM_NAV_BAR_REM}rem`, bottom: `calc(${BOTTOM_NAV_GAP_REM}rem + env(safe-area-inset-bottom))` }}
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
            className={cn(TAB_CLASS, active ? "text-sidebar-primary" : "text-sidebar-foreground/60")}
          >
            {active ? <ActivePill /> : null}
            <span className="relative flex h-7 w-10 items-center justify-center">
              <Icon className="relative z-10 size-6" aria-hidden="true" />
              {showBadge ? (
                <span
                  aria-label={tr(badge.ariaLabel)}
                  className="absolute -top-0.5 -right-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-bold leading-none text-sidebar-primary-foreground tabular-nums ring-2 ring-sidebar"
                >
                  {badge.countLabel ?? badge.count}
                </span>
              ) : null}
            </span>
            <span className="relative z-10 max-w-full truncate px-0.5 leading-none tracking-tight">{tr(item.label)}</span>
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
        className={cn(TAB_CLASS, !inPrimary ? "text-sidebar-primary" : "text-sidebar-foreground/60")}
      >
        {!inPrimary ? <ActivePill /> : null}
        <span className="relative flex h-7 w-10 items-center justify-center">
          <MoreHorizontal className="relative z-10 size-6" aria-hidden="true" />
        </span>
        <span className="relative z-10 leading-none">{tr(MORE_LABEL)}</span>
      </button>
    </nav>
  );
}
