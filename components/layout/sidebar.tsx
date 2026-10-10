"use client";

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
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { useSidebar } from "@/components/layout/sidebar-context";
import { AppVersionLabel } from "@/components/layout/app-version-label";
import { SidebarSlotProvider } from "@/components/layout/sidebar-slot";
import { authClient } from "@/lib/auth/client";
import {
  DropdownMenu,
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
}: {
  item: NavItem;
  collapsed: boolean;
  active?: boolean;
  /** Badge con contatore: pallino sull'icona nella sidebar compatta, numero a destra in quella espansa. */
  badge?: NavBadge;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const showBadge = badge !== undefined && badge.count > 0;

  if (item.comingSoon) {
    return (
      <span
        aria-disabled="true"
        title={collapsed ? `${item.label} (in arrivo)` : undefined}
        className={cn(
          "flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
          "text-sidebar-foreground/40",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-4")} aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="truncate leading-none">{item.label}</span>
            <span className="ml-auto rounded-full border border-sidebar-border px-1.5 py-0.5 text-[10px] leading-none text-sidebar-foreground/60">
              {COMING_SOON_LABEL}
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
        "transition-colors duration-150",
        "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <span className="relative flex shrink-0">
        <Icon
          className={cn(
            "shrink-0 transition-transform duration-150",
            collapsed ? "size-5" : "size-4",
            active && "text-sidebar-primary"
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
        <span className="truncate leading-none">{item.label}</span>
      )}
      {showBadge && !collapsed && (
        <span
          aria-label={badge.ariaLabel}
          className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-xs font-bold leading-none text-sidebar-primary-foreground tabular-nums"
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
        alt=""
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
}: AppSidebarProps) {
  const { collapsed, toggleCollapsed } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { data: sessionData } = authClient.useSession();
  // La sessione si legge solo sul client: finché non siamo idratati si usa il placeholder, come sul server,
  // altrimenti nome e iniziali renderizzati dal server ("Utente", "U") non combaciano con quelli del client.
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);
  const session = mounted ? sessionData : null;

  const userName = session?.user.name ?? "Utente";
  const userImage = session?.user.image ?? null;
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  // In modalità forceExpanded (drawer mobile) la sidebar è sempre espansa.
  const isCollapsed = forceExpanded ? false : collapsed;

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar border-r border-sidebar-border",
        "transition-[width] duration-300 ease-in-out overflow-hidden",
        isCollapsed ? "w-[64px]" : "w-[240px]"
      )}
      aria-label="Navigazione principale"
    >
      {/* ── Header: Logo / Brand ── */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          isCollapsed ? "justify-center px-2" : "px-5"
        )}
      >
        {isCollapsed ? (
          <Image
            src="/brand/logo-mark.svg"
            alt="BuddyBudget"
            width={28}
            height={34}
            className="h-8 w-auto"
          />
        ) : (
          <span className="flex items-center gap-2 min-w-0">
            <Image
              src="/brand/logo-mark.svg"
              alt=""
              width={24}
              height={29}
              className="h-6 w-auto shrink-0"
              aria-hidden="true"
            />
            <span className="font-heading text-base font-bold text-sidebar-foreground truncate">
              BuddyBudget
            </span>
          </span>
        )}
      </div>

      {/* ── Navigazione ── */}
      <nav className="sidebar-nav flex-1 overflow-y-auto px-2 py-3" aria-label="Menu">
        <ul className="flex flex-col gap-0.5" role="list">
          {items.map((item) => {
            return (
              <li key={item.href}>
                <NavLink
                  item={item}
                  collapsed={isCollapsed}
                  active={activeHref ? activeHref === item.href : isActivePath(pathname, item.href)}
                  badge={badges?.[item.href]}
                  onNavigate={onClose}
                />
              </li>
            );
          })}
        </ul>
        {extra ? (
          <SidebarSlotProvider value={{ collapsed: isCollapsed, onNavigate: onClose }}>{extra}</SidebarSlotProvider>
        ) : null}
      </nav>

      {/* ── Footer: card utente + toggle tema + collapse button ── */}
      <div
        className={cn(
          "shrink-0 border-t border-sidebar-border",
          isCollapsed ? "px-2 py-3" : "px-4 py-3"
        )}
      >
        {/* Card utente — apre dropdown con logout */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-2 mb-3",
              "bg-sidebar-accent/50 hover:bg-sidebar-accent",
              "transition-colors duration-150 cursor-pointer",
              isCollapsed && "justify-center"
            )}
            aria-label="Opzioni utente"
          >
            <UserAvatar initials={userInitials} image={userImage} />
            {!isCollapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-sidebar-foreground leading-tight">
                  {userName}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60 leading-tight mt-0.5">
                  {session?.user.email ?? ""}
                </p>
              </div>
            )}
          </DropdownMenuTrigger>
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
              <Settings className="mr-2 size-4" aria-hidden="true" />
              Impostazioni
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                router.push(pathname.startsWith(supportHref) ? supportHref : `${supportHref}?da=${encodeURIComponent(pathname)}`);
                onClose?.();
              }}
              className="cursor-pointer"
            >
              <LifeBuoy className="mr-2 size-4" aria-hidden="true" />
              Aiuto e segnalazioni
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-neg focus:text-neg cursor-pointer">
              <LogOut className="mr-2 size-4" aria-hidden="true" />
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Toggle tema */}
        <div
          className={cn(
            "flex mb-2",
            isCollapsed ? "flex-col items-center gap-1" : "items-center justify-between px-1"
          )}
        >
          <ThemeToggle compact={isCollapsed} surface="sidebar" />
          <PrivacyToggle />
        </div>

        {/* Bottone collapse (solo desktop, non nel drawer mobile) */}
        {!forceExpanded && (
          <button
            onClick={toggleCollapsed}
            className={cn(
              "flex w-full items-center rounded-lg px-2 py-1.5",
              "text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground/70",
              "hover:bg-sidebar-accent transition-colors duration-150",
              isCollapsed ? "justify-center" : "gap-2"
            )}
            aria-label={isCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
            title={isCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft className="size-4" aria-hidden="true" />
                <span>Comprimi</span>
              </>
            )}
          </button>
        )}

        {/* Versione della build: cambia a ogni deploy */}
        <AppVersionLabel
          compact={isCollapsed}
          className={cn(
            "mt-2 text-sidebar-foreground/60",
            isCollapsed ? "text-center" : "px-2"
          )}
        />
      </div>
    </aside>
  );
}
