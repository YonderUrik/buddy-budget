"use client";

/**
 * MobileTopbar
 *
 * Barra superiore visibile esclusivamente su mobile (< 768px, `md:hidden`).
 * Fornisce accesso alla navigazione tramite un hamburger button che apre
 * il drawer della sidebar.
 *
 * Contiene:
 * - Brand/logo testuale
 * - Hamburger button (apre il drawer via SidebarContext)
 * - ThemeToggle
 *
 * Riusabilità: accetta `brandName` e `brandHref` come prop per essere
 * adattata ad altre app senza modifiche al componente.
 */

import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "@/components/layout/sidebar-context";

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface MobileTopbarProps {
  /** Nome del brand mostrato nella topbar. Default: "Patrimonio". */
  brandName?: string;
}

export function MobileTopbar({ brandName = "Patrimonio" }: MobileTopbarProps) {
  const { openMobile } = useSidebar();

  return (
    <header
      className={[
        "md:hidden",
        "flex h-14 items-center justify-between",
        "bg-sidebar border-b border-sidebar-border",
        "px-4 shrink-0",
      ].join(" ")}
      aria-label="Barra di navigazione"
    >
      {/* Hamburger */}
      <button
        onClick={openMobile}
        className={[
          "flex size-9 items-center justify-center rounded-lg",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent",
          "hover:text-sidebar-accent-foreground transition-colors duration-150",
        ].join(" ")}
        aria-label="Apri menu di navigazione"
        aria-haspopup="dialog"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* Brand */}
      <span className="font-heading text-base font-bold text-sidebar-foreground">
        {brandName}
      </span>

      {/* Theme toggle */}
      <ThemeToggle />
    </header>
  );
}
