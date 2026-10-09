"use client";

/**
 * AppShell
 *
 * Wrapper di layout principale dell'applicazione. Compone:
 * - `SidebarProvider` — fornisce lo stato collapsed/mobile al sottoalbero
 * - `MobileTopbar` — visibile solo su mobile (< 768px)
 * - `AppSidebar` — sidebar desktop (nascosta su mobile, icon-only su tablet)
 * - Drawer mobile — `AppSidebar` con `forceExpanded`, overlay e animazione
 * - `<main>` — contenuto della pagina, che si adatta alla larghezza sidebar
 *
 * Uso:
 * ```tsx
 * // app/layout.tsx
 * <AppShell>{children}</AppShell>
 * ```
 *
 * Riusabilità: `AppShell` non dipende dal contenuto delle pagine. Accetta
 * `activeHref` opzionale per propagarlo alla sidebar (utile quando il layout
 * non ha accesso diretto al router).
 *
 * Breakpoint gestiti:
 * - Mobile  < 768px  → topbar + drawer
 * - Tablet  768-1023px → sidebar icon-only fissa
 * - Desktop ≥ 1024px → sidebar espansa (collassabile manualmente)
 */

import { useEffect } from "react";
import { AppSidebar, NAV_ITEMS, type NavBadge } from "@/components/layout/sidebar";
import { MobileTopbar } from "@/components/layout/mobile-topbar";
import { BOTTOM_NAV_HEIGHT_REM, BottomNav } from "@/components/layout/bottom-nav";
import { track } from "@/lib/analytics";
import { useBottomNav } from "@/lib/hooks/use-sidebar-preferences";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";

/** Nome della scheda per le statistiche d'uso, dall'href della voce (tipo chiuso: mai percorsi o id). */
const BOTTOM_NAV_TABS: Record<string, "panoramica" | "liquidita" | "investimenti" | "debiti" | "altro"> = {
  "/panoramica": "panoramica",
  "/liquidita": "liquidita",
  "/investimenti": "investimenti",
  "/debiti": "debiti",
  altro: "altro",
};

// ---------------------------------------------------------------------------
// Inner shell (accede al context, deve stare dentro SidebarProvider)
// ---------------------------------------------------------------------------

interface InnerShellProps {
  children: React.ReactNode;
  activeHref?: string;
  sidebarExtra?: React.ReactNode;
  navBadges?: Record<string, NavBadge>;
}

function InnerShell({ children, activeHref, sidebarExtra, navBadges }: InnerShellProps) {
  const { collapsed, mobileOpen, closeMobile, openMobile } = useSidebar();
  const [bottomNav] = useBottomNav();

  // Chi sta in basso sulla pagina (pannello dei sync) sa di quanto alzarsi grazie a questa variabile.
  useEffect(() => {
    document.documentElement.style.setProperty("--bottom-nav-offset", bottomNav ? `${BOTTOM_NAV_HEIGHT_REM}rem` : "0px");
    return () => {
      document.documentElement.style.removeProperty("--bottom-nav-offset");
    };
  }, [bottomNav]);

  // Chiude il drawer mobile se la finestra viene allargata oltre il breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) closeMobile();
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [closeMobile]);

  // Blocca lo scroll del body quando il drawer mobile è aperto.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* ── Topbar mobile ── */}
      <MobileTopbar showMenuButton={!bottomNav} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar desktop/tablet: nascosta su mobile ── */}
        <div
          className={cn(
            "hidden md:flex md:shrink-0",
            // Su tablet forziamo icon-only indipendentemente dallo stato saved.
            // Usiamo max-md:hidden + md:flex; la larghezza è gestita dentro AppSidebar
            // via il token `collapsed` del context.
          )}
        >
          <AppSidebar activeHref={activeHref} badges={navBadges} extra={sidebarExtra} />
        </div>

        {/* ── Contenuto principale ── */}
        <main
          id="main-content"
          className={cn(
            "flex-1 overflow-y-auto",
            // Transizione coordinata con la sidebar per un resize fluido.
            "transition-[margin] duration-300 ease-in-out"
          )}
          // Accessibilità: link "skip to content" può puntare qui.
          tabIndex={-1}
        >
          {children}
          {/* Spazio sotto il contenuto per la barra in basso (solo mobile). */}
          {bottomNav ? <div className="md:hidden" style={{ height: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom))` }} aria-hidden="true" /> : null}
        </main>
      </div>

      {bottomNav ? (
        <BottomNav
          items={NAV_ITEMS}
          activeHref={activeHref}
          badges={navBadges}
          onOpenMore={openMobile}
          onTabClick={(key) => track("bottom_nav_clicked", { tab: BOTTOM_NAV_TABS[key] ?? "altro" })}
        />
      ) : null}

      {/* ── Drawer mobile ── */}
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 md:hidden",
          "transition-opacity duration-300",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Pannello drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:hidden",
          "transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu di navigazione"
      >
        <AppSidebar
          forceExpanded
          activeHref={activeHref}
          onClose={closeMobile}
          badges={navBadges}
          extra={sidebarExtra}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente pubblico
// ---------------------------------------------------------------------------

interface AppShellProps {
  children: React.ReactNode;
  /** Href della voce attiva. Propagato alla sidebar per evidenziare il link corrente. */
  activeHref?: string;
  /** Contenuto extra sotto le voci della sidebar (desktop e drawer mobile). */
  sidebarExtra?: React.ReactNode;
  /** Sottovoci con contatore sotto le voci della sidebar, per `href` della voce padre. */
  navBadges?: Record<string, NavBadge>;
}

/**
 * Shell applicazione. Wrappa il `SidebarProvider` e compone tutti i layer
 * di navigazione. Va usato come wrapper in `app/layout.tsx`.
 */
export function AppShell({ children, activeHref, sidebarExtra, navBadges }: AppShellProps) {
  return (
    <SidebarProvider>
      <InnerShell activeHref={activeHref} sidebarExtra={sidebarExtra} navBadges={navBadges}>
        {children}
      </InnerShell>
    </SidebarProvider>
  );
}
