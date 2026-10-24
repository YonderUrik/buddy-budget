"use client";
import { useLocalization } from "@/lib/localization/provider";
import { withCountryLocks } from "@/components/layout/country-locks";

/**
 * AppSidebar
 *
 * Barra di navigazione laterale principale dell'applicazione.
 *
 * Comportamento responsive:
 * - Desktop (≥1024px): espansa con logo, label voci, card utente, versione della build.
 *   L'utente può collassarla manualmente → icon-only (stato in localStorage).
 * - Tablet (768–1023px): entra automaticamente in icon-only al caricamento.
 * - Mobile (<768px): non renderizzata qui; il drawer mobile viene gestito
 *   da `AppShell` tramite questo stesso componente con `forceExpanded={true}`.
 *
 * Props:
 * - `forceExpanded`: usata dal drawer mobile per forzare la modalità espansa
 *   indipendentemente dallo stato `collapsed` del context.
 *
 * Riusabilità: la lista voci è definita nell'array `NAV_ITEMS` e può essere
 * sovrascritta via prop `items` per adattare la sidebar ad altri contesti.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Umbrella,
  CreditCard,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  LifeBuoy,
  Eye,
  MessageCircleQuestion,
} from "lucide-react";
import { LayoutGroup, motion } from "motion/react";

import { ThemeSubmenu, type ThemeChoice } from "@/components/theme-submenu";
import { track } from "@/lib/analytics";
import { usePrivacy } from "@/components/privacy-provider";
import { useSidebar } from "@/components/layout/sidebar-context";
import { AppVersionLabel } from "@/components/layout/app-version-label";
import { SidebarSlotProvider } from "@/components/layout/sidebar-slot";
import type { ShellAction } from "@/components/layout/shell-action";
import { usePendingNavHref } from "@/components/layout/use-pending-nav";
import { authClient } from "@/lib/auth/client";
import { SPRING_SNAPPY } from "@/lib/motion/springs";
import { SIDEBAR_ISLAND_CLASS } from "@/lib/sidebar/island";
import { HoverHighlight } from "@/components/motion";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Dati di navigazione
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Se true la voce è mostrata disabilitata con badge "Presto" (schermata non ancora disponibile). */
  comingSoon?: boolean;
  /** The section exists but is closed to this user (e.g. not in their country yet): shown dimmed with a badge, it opens `locked.href`. */
  locked?: NavLock;
}

/**
 * Why a section is closed and where its explanation lives. Gates (country rules, a subscription plan) build one each;
 * texts are Italian source keys translated by the catalogs.
 */
export interface NavLock {
  /** Page explaining why the section is closed. */
  href: string;
  /** Short badge next to the name (e.g. «Presto»). */
  badge: string;
  /** One line said by screen readers and tooltips, and under the name in the «Altro» menu. */
  hint: string;
  /** Called when the user opens the locked section (e.g. to count the demand for it). */
  onOpen?: () => void;
}

/** Badge con contatore accanto a una voce di navigazione (es. i movimenti da sistemare su Liquidità), mostrato solo con `count > 0`. */
export interface NavBadge {
  count: number;
  /** Testo del badge (es. "99+"); default: `count`. */
  countLabel?: string;
  /** Descrizione per gli screen reader (es. "3 movimenti da sistemare"). */
  ariaLabel?: string;
}

/** Etichetta del badge per le voci non ancora disponibili. */
const COMING_SOON_LABEL = "Presto";

/** Nome categorico della scelta di tema per l'evento di prodotto. */
const THEME_EVENT_CHOICE = { light: "chiaro", dark: "scuro", system: "sistema" } as const satisfies Record<ThemeChoice, string>;

/**
 * Le voci di navigazione dell'applicazione.
 * Esportata per permettere override o test unitari senza montare il componente.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Panoramica", href: "/panoramica", icon: LayoutDashboard },
  { label: "Liquidità", href: "/liquidita", icon: Wallet },
  { label: "Investimenti", href: "/investimenti", icon: TrendingUp },
  { label: "Pensione", href: "/pensione", icon: Umbrella },
  { label: "Debiti", href: "/debiti", icon: CreditCard },
  { label: "Analitiche", href: "/analitiche", icon: BarChart3 },
];

/** True se `pathname` corrisponde alla voce `href` o a una sua sotto-route. */
function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ---------------------------------------------------------------------------
// Sotto-componenti interni
// ---------------------------------------------------------------------------

/** Singola voce di navigazione con gestione collapsed/expanded. */
function NavLink({
  item,
  collapsed,
  active = false,
  badge,
  onNavigate,
  islands = false,
}: {
  item: NavItem;
  collapsed: boolean;
  active?: boolean;
  /** Badge con contatore: pallino sull'icona nella sidebar compatta, numero a destra in quella espansa. */
  badge?: NavBadge;
  onNavigate?: () => void;
  /** Desktop islands: pill-shaped item, yellow pill when active, hover drawn by the list's `HoverHighlight`. */
  islands?: boolean;
}) {
  const { t: tr } = useLocalization();
  const Icon = item.icon;
  const showBadge = badge !== undefined && badge.count > 0;
  const shape = islands ? "rounded-full" : "rounded-lg";

  if (item.locked) {
    const lock = item.locked;
    return (
      <Link
        href={lock.href}
        title={collapsed ? `${tr(item.label)} · ${tr(lock.hint)}` : tr(lock.hint)}
        aria-label={`${tr(item.label)}: ${tr(lock.hint)}`}
        onClick={() => {
          lock.onOpen?.();
          onNavigate?.();
        }}
        data-hover-target={islands ? "" : undefined}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
          shape,
          "text-sidebar-foreground/45 hover:text-sidebar-foreground/70",
          !islands && "hover:bg-sidebar-accent",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-4")} aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="truncate leading-none">{tr(item.label)}</span>
            <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] leading-none text-sidebar-foreground/60">
              {tr(lock.badge)}
            </span>
          </>
        )}
      </Link>
    );
  }

  if (item.comingSoon) {
    return (
      <span
        aria-disabled="true"
        title={collapsed ? tr("{0} (in arrivo)", {0: tr(item.label)}) : undefined}
        className={cn(
          "flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
          "text-sidebar-foreground/40",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-4")} aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="truncate leading-none">{tr(item.label)}</span>
            <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] leading-none text-sidebar-foreground/60">
              {tr(COMING_SOON_LABEL)}
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? tr(item.label) : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      data-hover-target={islands ? "" : undefined}
      className={cn(
        "group relative flex items-center gap-3 py-2.5 text-sm font-medium",
        islands ? "px-4" : "px-3",
        shape,
        "transition-colors duration-150",
        "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground",
        active
          ? islands
            ? "text-on-sun hover:text-on-sun"
            : "text-sidebar-accent-foreground"
          : !islands && "hover:bg-sidebar-accent",
        collapsed && "justify-center px-2"
      )}
    >
      {/* Active item background (yellow pill in the islands, grey with a yellow marker in the drawer): one per list, it slides between items (`layoutId`). */}
      {active ? (
        <motion.span
          layoutId="sidebar-active-pill"
          transition={SPRING_SNAPPY}
          className={cn("absolute inset-0", shape, islands ? "bg-sun" : "bg-sidebar-accent")}
          aria-hidden="true"
        >
          {islands ? null : <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-sun" />}
        </motion.span>
      ) : null}
      <span className="relative z-10 flex shrink-0">
        <Icon
          className={cn(
            "shrink-0 transition-transform duration-150",
            collapsed ? "size-5" : "size-4"
          )}
          aria-hidden="true"
        />
        {showBadge && collapsed && (
          <span
            className="absolute -right-1 -top-1 size-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar"
            aria-hidden="true"
          />
        )}
      </span>
      {!collapsed && (
        <span className="relative z-10 truncate leading-none">{tr(item.label)}</span>
      )}
      {showBadge && !collapsed && (
        <span
          aria-label={tr(badge.ariaLabel)}
          className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-xs font-bold leading-none text-sidebar-primary-foreground tabular-nums"
        >
          {badge.countLabel ?? badge.count}
        </span>
      )}
    </Link>
  );
}

/** Avatar utente: immagine profilo se disponibile, altrimenti iniziali. */
function UserAvatar({ initials, image }: { initials: string; image?: string | null }) {

  if (image) {
    return (
      <Image
        src={image}
        alt={""}
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full object-cover"
        aria-hidden="true"
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        "bg-sidebar-primary text-sidebar-primary-foreground",
        "text-xs font-semibold tracking-wide"
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/** Every block of the desktop sidebar is an island: a separate card with rounded corners. */
const ISLAND = SIDEBAR_ISLAND_CLASS;

/** Round icon buttons in the account island. */
const ISLAND_ICON_BUTTON =
  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground";

/** Store vuoto: distingue il render server (false) da quello client (true). */
const subscribeNoop = () => () => {};

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

interface AppSidebarProps {
  /** Se true, ignora lo stato collapsed del context e mostra sempre la versione espansa. */
  forceExpanded?: boolean;
  /** Lista voci di navigazione. Default: NAV_ITEMS. */
  items?: NavItem[];
  /** Href della voce attualmente attiva. */
  activeHref?: string;
  /** Callback opzionale alla chiusura (usata dal drawer mobile). */
  onClose?: () => void;
  /** Pagina delle impostazioni utente, raggiungibile dal menu dell'avatar. */
  settingsHref?: string;
  /** Pagina «Aiuto e segnalazioni», raggiungibile dal menu dell'avatar; porta con sé la pagina corrente come contesto. */
  supportHref?: string;
  /** Badge con contatore, per `href` della voce (es. `{ "/liquidita": { count: 9 } }`). */
  badges?: Record<string, NavBadge>;
  /** Contenuto extra sotto le voci di navigazione (es. riepilogo del portafoglio). Legge lo stato con `useSidebarSlot`. */
  extra?: React.ReactNode;
  /** Apre il foglio «Scrivici» (segnalazione rapida); senza, il pulsante non compare. */
  onOpenSupport?: () => void;
  /** Main action (e.g. «Aggiungi»): a pill under the logo (a yellow round button when the sidebar is collapsed). */
  addAction?: ShellAction;
}

export function AppSidebar({
  forceExpanded = false,
  items = NAV_ITEMS,
  activeHref,
  onClose,
  settingsHref = "/impostazioni",
  supportHref = "/aiuto",
  badges,
  extra,
  onOpenSupport,
  addAction,
}: AppSidebarProps) {
  const { t: tr } = useLocalization();
  const { productCountry } = useLocalization();
  const { collapsed, toggleCollapsed } = useSidebar();
  const { hidden, toggle: toggleHidden } = usePrivacy();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingHref, startNav] = usePendingNavHref();
  /** Una sidebar desktop e una nel menu mobile possono convivere: ognuna ha la sua pillola. */
  const navGroupId = React.useId();
  const { data: sessionData } = authClient.useSession();
  // La sessione si legge solo sul client: finché non siamo idratati si usa il placeholder, come sul server,
  // altrimenti nome e iniziali renderizzati dal server ("Utente", "U") non combaciano con quelli del client.
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);
  const session = mounted ? sessionData : null;

  const userName = session?.user.name ?? tr("Utente");
  const userImage = session?.user.image ?? null;
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await authClient.signOut();
    // Ricarica completa: svuota la cache in memoria, così il prossimo utente della scheda non vede dati altrui.
    window.location.assign("/login");
  }

  // In modalità forceExpanded (drawer mobile) la sidebar è sempre espansa.
  const isCollapsed = forceExpanded ? false : collapsed;
  // The desktop sidebar is made of islands; the mobile drawer keeps a single panel.
  const islands = !forceExpanded;
  const firstName = userName.split(" ")[0];

  // Header: logo and brand (back to the start page).
  const header = (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center",
        !islands && "border-b border-sidebar-border",
        isCollapsed ? "justify-center px-2" : "px-5"
      )}
    >
      <Link
        href="/"
        onClick={onClose}
        aria-label={tr("BuddyBudget: torna alla pagina iniziale")}
        className={cn(
          "flex min-w-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isCollapsed ? "justify-center p-1" : "gap-2"
        )}
      >
        {isCollapsed ? (
          <Image src="/brand/logo-mark.svg" alt={""} width={28} height={34} className="h-8 w-auto" aria-hidden="true" />
        ) : (
          <>
            <Image
              src="/brand/logo-mark.svg"
              alt={""}
              width={24}
              height={29}
              className="h-6 w-auto shrink-0"
              aria-hidden="true"
            />
            <span className="font-heading text-base font-bold text-sidebar-foreground truncate">{tr("BuddyBudget")}</span>
          </>
        )}
      </Link>
    </div>
  );

  // Main action under the logo: a pill with the label (a round button when the sidebar is collapsed).
  const addRow =
    addAction ? (
      <div className={cn("px-2 pb-2", isCollapsed && "flex justify-center")}>
        <button
          type="button"
          onClick={(event) => {
            addAction.onClick(event.currentTarget, "sidebar");
            onClose?.();
          }}
          aria-label={isCollapsed ? tr(addAction.label) : undefined}
          title={isCollapsed ? tr(addAction.label) : undefined}
          aria-haspopup="dialog"
          className={cn(
            "group/add flex cursor-pointer items-center rounded-full text-sm font-medium text-sidebar-foreground transition-colors duration-150",
            isCollapsed ? "size-11 justify-center bg-sun text-on-sun hover:bg-sun-hover" : "h-11 w-full gap-3 bg-sidebar-accent pr-4 pl-1.5 hover:bg-sidebar-accent/70"
          )}
        >
          {isCollapsed ? (
            <addAction.icon className="size-5" strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sun text-on-sun">
                <addAction.icon className="size-4" strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span className="truncate">{tr(addAction.label)}</span>
            </>
          )}
        </button>
      </div>
    ) : null;

  const navList = (
    <LayoutGroup id={navGroupId}>
      <HoverHighlight mode="stretch" highlightClassName="rounded-full bg-sidebar-accent">
        <ul className="flex flex-col gap-0.5" role="list">
          {withCountryLocks(items, productCountry).map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                collapsed={isCollapsed}
                islands={islands}
                active={
                  pendingHref
                    ? pendingHref === item.href
                    : activeHref
                      ? activeHref === item.href
                      : isActivePath(pathname, item.href)
                }
                badge={badges?.[item.href]}
                onNavigate={() => {
                  startNav(item.href);
                  onClose?.();
                }}
              />
            </li>
          ))}
        </ul>
      </HoverHighlight>
    </LayoutGroup>
  );

  const extraContent = extra ? (
    <SidebarSlotProvider value={{ collapsed: isCollapsed, onNavigate: onClose, cards: islands }}>{extra}</SidebarSlotProvider>
  ) : null;

  // Account menu, opened by the avatar. In the islands the e-mail and the build version live only here.
  const userMenu = (
    <DropdownMenuContent side="top" align="start" className="w-56">
      <div className="px-2 py-1.5">
        <p className="text-sm font-medium">{userName}</p>
        <p className="text-xs text-muted-foreground truncate">{session?.user.email ?? ""}</p>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          router.push(settingsHref);
          onClose?.();
        }}
        className="cursor-pointer"
      >
        <Settings className="mr-2 size-4" aria-hidden="true" />{tr("Impostazioni")}</DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          router.push(pathname.startsWith(supportHref) ? supportHref : `${supportHref}?da=${encodeURIComponent(pathname)}`);
          onClose?.();
        }}
        className="cursor-pointer"
      >
        <LifeBuoy className="mr-2 size-4" aria-hidden="true" />{tr("Aiuto e segnalazioni")}</DropdownMenuItem>
      <DropdownMenuCheckboxItem
        checked={hidden}
        onCheckedChange={(checked) => {
          toggleHidden();
          track("amounts_hidden_toggled", { enabled: checked, source: "menu_utente" });
        }}
        className="cursor-pointer"
      >
        <Eye className="mr-2 size-4" aria-hidden="true" />{tr("Nascondi gli importi")}</DropdownMenuCheckboxItem>
      <ThemeSubmenu
        onChange={(choice) =>
          track("theme_changed", { choice: THEME_EVENT_CHOICE[choice], source: "menu_utente" })
        }
      />
      <DropdownMenuItem onClick={handleSignOut} className="text-neg focus:text-neg cursor-pointer">
        <LogOut className="mr-2 size-4" aria-hidden="true" />{tr("Esci")}</DropdownMenuItem>
      {islands ? (
        <>
          <DropdownMenuSeparator />
          <AppVersionLabel className="px-2 py-1 text-xs text-muted-foreground" />
        </>
      ) : null}
    </DropdownMenuContent>
  );

  if (islands) {
    return (
      <div
        className={cn(
          "group/islands flex h-full flex-col gap-3 py-3 pl-3 transition-[width] duration-300 ease-in-out",
          isCollapsed ? "w-[76px]" : "w-[252px]"
        )}
      >
        {/* With every summary module turned off the menu island grows down to the account island. */}
        <aside
          className={cn(ISLAND, "shrink-0 overflow-hidden group-has-[[data-sidebar-modules]:empty]/islands:flex-1")}
          aria-label={tr("Navigazione principale")}
        >
          {header}
          {addRow}
          <nav className="px-2 pb-3" aria-label={tr("Menu")}>
            {navList}
          </nav>
        </aside>
        {/* Summary modules: each one draws its own island (`cards` in the slot); hidden modules leave no gap. */}
        <div data-sidebar-modules="" className="sidebar-nav flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto empty:hidden">
          {extraContent}
        </div>
        <div className={cn(ISLAND, "flex shrink-0 items-center gap-1 p-2", isCollapsed && "flex-col")}>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-full p-1 transition-colors duration-150 hover:bg-sidebar-accent",
                isCollapsed ? "justify-center" : "flex-1 pr-3"
              )}
              aria-label={tr("Opzioni utente")}
            >
              <UserAvatar initials={userInitials} image={userImage} />
              {!isCollapsed && <span className="truncate text-sm font-medium text-sidebar-foreground">{firstName}</span>}
            </DropdownMenuTrigger>
            {userMenu}
          </DropdownMenu>
          {onOpenSupport ? (
            <button
              type="button"
              onClick={onOpenSupport}
              className={ISLAND_ICON_BUTTON}
              aria-label={tr("Scrivici")}
              title={tr("Scrivici")}
            >
              <MessageCircleQuestion className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={ISLAND_ICON_BUTTON}
            aria-label={isCollapsed ? tr("Espandi sidebar") : tr("Comprimi sidebar")}
            title={isCollapsed ? tr("Espandi sidebar") : tr("Comprimi sidebar")}
          >
            {isCollapsed ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronLeft className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    );
  }

  // Mobile drawer: one full-height panel, unchanged.
  return (
    <aside className="flex h-full w-[240px] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar" aria-label={tr("Navigazione principale")}>
      {header}
      {addRow ? <div className="pt-3">{addRow}</div> : null}
      <nav className="sidebar-nav flex-1 overflow-y-auto px-2 py-3" aria-label={tr("Menu")}>
        {navList}
        {extraContent}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
        {onOpenSupport ? (
          <button
            type="button"
            onClick={() => {
              onOpenSupport();
              onClose?.();
            }}
            className={cn(
              "mb-2 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-sidebar-foreground/75",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150"
            )}
          >
            <MessageCircleQuestion className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{tr("Scrivici")}</span>
          </button>
        ) : null}
        {/* Card utente — apre dropdown con logout */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-2 mb-3",
              "bg-sidebar-accent/50 hover:bg-sidebar-accent",
              "transition-colors duration-150 cursor-pointer"
            )}
            aria-label={tr("Opzioni utente")}
          >
            <UserAvatar initials={userInitials} image={userImage} />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-sidebar-foreground leading-tight">{userName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60 leading-tight mt-0.5">{session?.user.email ?? ""}</p>
            </div>
          </DropdownMenuTrigger>
          {userMenu}
        </DropdownMenu>
        {/* Versione della build: cambia a ogni deploy */}
        <AppVersionLabel className="mt-2 px-2 text-sidebar-foreground/60" />
      </div>
    </aside>
  );
}
