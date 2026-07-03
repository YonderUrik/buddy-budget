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
import { AppSidebar } from "@/components/layout/sidebar";
import { MobileTopbar } from "@/components/layout/mobile-topbar";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Inner shell (accede al context, deve stare dentro SidebarProvider)
// ---------------------------------------------------------------------------

interface InnerShellProps {
  children: React.ReactNode;
  activeHref?: string;
}

function InnerShell({ children, activeHref }: InnerShellProps) {
  const { collapsed, mobileOpen, closeMobile } = useSidebar();

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
      <MobileTopbar />

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
          <AppSidebar activeHref={activeHref} />
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
        </main>
      </div>

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
}

/**
 * Shell applicazione. Wrappa il `SidebarProvider` e compone tutti i layer
 * di navigazione. Va usato come wrapper in `app/layout.tsx`.
 */
export function AppShell({ children, activeHref }: AppShellProps) {
  return (
    <SidebarProvider>
      <InnerShell activeHref={activeHref}>{children}</InnerShell>
    </SidebarProvider>
  );
}
