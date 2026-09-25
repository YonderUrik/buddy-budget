"use client";

/**
 * AppSidebar
 *
 * Barra di navigazione laterale principale dell'applicazione.
 *
 * Comportamento responsive:
 * - Desktop (≥1024px): espansa con logo, label voci, card utente.
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

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  ShoppingCart,
  ArrowLeftRight,
  TrendingUp,
  Umbrella,
  CreditCard,
  Target,
  BarChart3,
  Tags,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "@/components/layout/sidebar-context";
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

/** Etichetta del badge per le voci non ancora disponibili. */
const COMING_SOON_LABEL = "Presto";

/**
 * Le voci di navigazione dell'applicazione.
 * Esportata per permettere override o test unitari senza montare il componente.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Panoramica", href: "/panoramica", icon: LayoutDashboard },
  { label: "Conti", href: "/conti", icon: Landmark },
  { label: "Transazioni", href: "/transazioni", icon: ShoppingCart },
  { label: "Categorie", href: "/categorie", icon: Tags },
  { label: "Cash flow", href: "/cash-flow", icon: ArrowLeftRight },
  { label: "Investimenti", href: "/investimenti", icon: TrendingUp, comingSoon: true },
  { label: "Pensione", href: "/pensione", icon: Umbrella, comingSoon: true },
  { label: "Debiti", href: "/debiti", icon: CreditCard, comingSoon: true },
  { label: "Pianifica", href: "/pianifica", icon: Target, comingSoon: true },
  { label: "Analitiche", href: "/analitiche", icon: BarChart3, comingSoon: true },
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
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

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
      <Icon
        className={cn(
          "shrink-0 transition-transform duration-150",
          collapsed ? "size-5" : "size-4",
          active && "text-sidebar-primary"
        )}
        aria-hidden="true"
      />
      {!collapsed && (
        <span className="truncate leading-none">{item.label}</span>
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
}

export function AppSidebar({
  forceExpanded = false,
  items = NAV_ITEMS,
  activeHref,
  onClose,
}: AppSidebarProps) {
  const { collapsed, toggleCollapsed } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

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
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                collapsed={isCollapsed}
                active={activeHref ? activeHref === item.href : isActivePath(pathname, item.href)}
                onNavigate={onClose}
              />
            </li>
          ))}
        </ul>
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
                <p className="truncate text-xs text-sidebar-foreground/50 leading-tight mt-0.5">
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
            isCollapsed ? "justify-center" : "justify-start px-1"
          )}
        >
          <ThemeToggle compact={isCollapsed} />
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
      </div>
    </aside>
  );
}
