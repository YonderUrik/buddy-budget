"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * BottomNav
 *
 * Bottom tab bar, phone only (< 768px): a floating rounded capsule inset from the screen edges, like the iOS 26 tab bar,
 * with icon and label per section, the "to sort" badge where needed and a last «Altro» tab that opens the full menu.
 * «Altro» is active when the current page is not one of the tabs. With `compact` (the user is scrolling down the page) the
 * capsule gets lower and the labels fade out, leaving the icons; it grows back on the way up.
 *
 * Reusability: items, badges and active item come from outside; `primaryHrefs` picks which items sit in the bar.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { NavBadge, NavItem } from "@/components/layout/sidebar";
import type { ShellAction } from "@/components/layout/shell-action";
import { usePendingNavHref } from "@/components/layout/use-pending-nav";
import { BAR_RESIZE_TRANSITION, SPRING_SNAPPY } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

/** Items shown in the bar: the four most used sections, the rest is under «Altro». */
export const BOTTOM_NAV_HREFS = ["/panoramica", "/liquidita", "/investimenti", "/debiti"] as const;
/** Items shown when the main action sits in the middle of the bar: three sections, the action, «Altro». */
export const BOTTOM_NAV_HREFS_WITH_ACTION = ["/panoramica", "/liquidita", "/investimenti"] as const;

/** Label of the tab that opens the full menu. */
const MORE_LABEL = "Altro";

/** Height of the floating capsule (rem). */
const BOTTOM_NAV_BAR_REM = 4;
/** Height of the capsule while compact (rem): icons only, still a 48 px touch target. */
const BOTTOM_NAV_COMPACT_BAR_REM = 3;
/** Gap between the capsule and the bottom edge (rem), above the home indicator in the app. */
const BOTTOM_NAV_GAP_REM = 0.75;
/** Gap between the capsule and the side edges of the screen (rem). */
const BOTTOM_NAV_SIDE_REM = 0.75;
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
  /** Lower capsule with icons only, while the page is scrolled down (labels stay for screen readers). */
  compact?: boolean;
  /** Main action (e.g. «Aggiungi»): a yellow round button in the middle of the bar or beside it. */
  action?: ShellAction;
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
      className="absolute inset-x-0 inset-y-1 rounded-full bg-glass-pill"
      aria-hidden="true"
    />
  );
}

const TAB_CLASS = "relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-full text-[11px] font-medium transition-colors";

/** Tab label: folds away while the bar is compact. The text fades, blurs and sinks a little as its line closes, and comes
 * back once the bar has made room for it, so icons glide instead of jumping. */
function TabLabel({ compact, reduced, children }: { compact: boolean; reduced: boolean; children: React.ReactNode }) {
  const size = reduced ? { duration: 0 } : BAR_RESIZE_TRANSITION;
  return (
    <motion.span
      initial={false}
      animate={compact ? { height: 0, marginTop: 0 } : { height: "auto", marginTop: 2 }}
      transition={size}
      className="relative z-10 block max-w-full overflow-hidden"
    >
      <motion.span
        initial={false}
        animate={compact ? { opacity: 0, y: 4, scale: 0.9, filter: "blur(2px)" } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={reduced ? { duration: 0 } : compact ? { duration: 0.14, ease: "easeOut" } : { duration: 0.2, delay: 0.08, ease: "easeOut" }}
        className="block truncate px-0.5 leading-none tracking-tight"
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

/** Yellow round button of the main action; it shrinks with the bar. */
function ActionButton({ action, compact, reduced, beside }: { action: ShellAction; compact: boolean; reduced: boolean; beside: boolean }) {
  const { t: tr } = useLocalization();
  const Icon = action.icon;
  const size = beside ? (compact ? BOTTOM_NAV_COMPACT_BAR_REM : BOTTOM_NAV_BAR_REM) : compact ? 2.5 : 3.25;
  return (
    <motion.button
      type="button"
      initial={false}
      animate={{ width: `${size}rem`, height: `${size}rem` }}
      transition={reduced ? { duration: 0 } : BAR_RESIZE_TRANSITION}
      onClick={(event) => action.onClick(event.currentTarget)}
      aria-label={tr(action.label)}
      aria-haspopup="dialog"
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center self-center rounded-full bg-sun text-on-sun transition-colors active:bg-sun-hover",
        beside && "shadow-[0_10px_30px_-6px_var(--glass-shadow)]"
      )}
    >
      <Icon className={beside ? "size-7" : "size-6"} strokeWidth={2.25} aria-hidden="true" />
    </motion.button>
  );
}

export function BottomNav({ items, primaryHrefs = BOTTOM_NAV_HREFS, activeHref, badges, onOpenMore, onTabClick, compact = false, action }: BottomNavProps) {
  const { t: tr } = useLocalization();
  const pathname = usePathname();
  const [pendingHref, startNav] = usePendingNavHref();
  const primary = primaryHrefs.flatMap((href) => items.filter((i) => i.href === href && !i.comingSoon && !i.locked));
  const current = pendingHref ?? activeHref ?? pathname;
  const inPrimary = primary.some((i) => isActivePath(current, i.href));
  // Reduced motion: the bar still changes size, at once instead of gliding.
  const reduced = useReducedMotion() ?? false;
  // In the middle: as many tabs on its left as on its right («Altro» counts as the last tab).
  const centerAction = action && action.placement !== "beside" ? action : null;
  const centerIndex = Math.ceil((primary.length + 1) / 2);

  return (
    <div
      className="fixed z-30 flex items-end gap-2 md:hidden"
      // Away from the screen edges and from the notch/camera cutout when the phone is turned sideways.
      style={{
        bottom: `calc(${BOTTOM_NAV_GAP_REM}rem + env(safe-area-inset-bottom))`,
        left: `max(${BOTTOM_NAV_SIDE_REM}rem, env(safe-area-inset-left))`,
        right: `max(${BOTTOM_NAV_SIDE_REM}rem, env(safe-area-inset-right))`,
      }}
    >
    <motion.nav
      initial={false}
      animate={{ height: `${compact ? BOTTOM_NAV_COMPACT_BAR_REM : BOTTOM_NAV_BAR_REM}rem` }}
      transition={reduced ? { duration: 0 } : BAR_RESIZE_TRANSITION}
      data-compact={compact ? "" : undefined}
      aria-label={tr("Navigazione principale")}
      className={cn(
        "flex min-w-0 flex-1 rounded-full border border-glass-edge px-1",
        // «Liquid Glass»: translucent fill, the page blurred and more saturated behind it, light on the top edge.
        "bg-glass shadow-[inset_0_1px_0_var(--glass-highlight),0_10px_30px_-6px_var(--glass-shadow)]",
        "supports-backdrop-filter:backdrop-blur-2xl supports-backdrop-filter:backdrop-saturate-[1.8]",
        // Without backdrop-filter the fill would be too thin to read the labels over the page.
        "not-supports-backdrop-filter:bg-sidebar"
      )}
    >
      {primary.map((item, index) => {
        const active = isActivePath(current, item.href);
        const badge = badges?.[item.href];
        const showBadge = badge !== undefined && badge.count > 0;
        const Icon = item.icon;
        return (
          <React.Fragment key={item.href}>
          {centerAction && index === centerIndex ? <ActionButton action={centerAction} compact={compact} reduced={reduced} beside={false} /> : null}
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              startNav(item.href);
              onTabClick?.(item.href);
            }}
            className={cn(TAB_CLASS, active ? "text-sidebar-primary" : "text-sidebar-foreground/70")}
          >
            {active ? <ActivePill /> : null}
            <span className="relative flex h-7 w-10 items-center justify-center">
              <Icon className="relative z-10 size-6" aria-hidden="true" />
              {showBadge ? (
                <span
                  aria-label={tr(badge.ariaLabel)}
                  className="absolute -top-0.5 -right-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-bold leading-none text-sidebar-primary-foreground tabular-nums ring-2 ring-background"
                >
                  {badge.countLabel ?? badge.count}
                </span>
              ) : null}
            </span>
            <TabLabel compact={compact} reduced={reduced}>
              {tr(item.label)}
            </TabLabel>
          </Link>
          </React.Fragment>
        );
      })}
      {centerAction && centerIndex >= primary.length ? <ActionButton action={centerAction} compact={compact} reduced={reduced} beside={false} /> : null}
      <button
        type="button"
        onClick={() => {
          onTabClick?.("altro");
          onOpenMore();
        }}
        aria-haspopup="dialog"
        className={cn(TAB_CLASS, !inPrimary ? "text-sidebar-primary" : "text-sidebar-foreground/70")}
      >
        {!inPrimary ? <ActivePill /> : null}
        <span className="relative flex h-7 w-10 items-center justify-center">
          <MoreHorizontal className="relative z-10 size-6" aria-hidden="true" />
        </span>
        <TabLabel compact={compact} reduced={reduced}>
          {tr(MORE_LABEL)}
        </TabLabel>
      </button>
    </motion.nav>
    {action && action.placement === "beside" ? <ActionButton action={action} compact={compact} reduced={reduced} beside /> : null}
    </div>
  );
}
